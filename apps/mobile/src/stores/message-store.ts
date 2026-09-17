/**
 * Message store — sender outbox + receiver inbox, realtime wiring, sync.
 *
 * Implements the image's flows:
 *  - Step 4 "SMS Received": encrypt -> local outbox -> try Socket.IO, fall back to REST
 *  - Step 5 "Offline Handling": PENDING entries retried automatically on reconnect
 *  - Step 6 "Real-time Delivery": incoming messages + acknowledgements
 *  - Step 7 "Message Sync": fetch after lastSeq cursor on start/reconnect
 */
import { create } from "zustand";
import type { EncryptedPayload, MessageDTO, PairDTO } from "@simbridge/shared";
import { decrypt, encrypt } from "@simbridge/crypto";
import "./random-polyfill";
import { secrets, storage, type OutboxEntry } from "../lib/storage";
import { api } from "../lib/api";
import { connectSocket, getSocket, emitWithAck } from "../lib/socket";
import { useDeviceStore } from "./device-store";
import { notify } from "../lib/notifications";

let wired = false;
let unsubFns: Array<() => void> = [];

export interface InboxEntry extends MessageDTO {
  decrypted?: string;
}

interface MessageState {
  outbox: OutboxEntry[];
  inbox: InboxEntry[];
  lastSeq: Record<string, number>;

  loadLocal: () => Promise<void>;

  /** Step 4 — SMS received on sender: encrypt, persist to outbox, deliver. */
  enqueueSms: (input: {
    smsBody: string;
    receiverNumber: string;
    pairId: string;
    receiverPublicKey: string;
    sim: OutboxEntry["sim"];
  }) => Promise<void>;

  /** Step 5 — retry PENDING/FAILED outbox entries (reconnect / app start). */
  flushOutbox: () => Promise<void>;

  /** Step 7 — fetch missed messages for every active pair (lastSeq cursor). */
  syncAll: () => Promise<void>;

  decryptEntry: (entry: InboxEntry) => Promise<string>;

  /** Step 6 — real-time wiring: incoming / delivered / sync hints / presence. */
  wireRealtime: () => Promise<void>;
  unwrapRealtime: () => void;
}

function receiverSecret(): Promise<string | null> {
  return secrets.get("secretKey");
}

async function deliver(
  entry: OutboxEntry,
  payload: EncryptedPayload,
): Promise<void> {
  const socket = getSocket();
  let delivered = false;

  if (socket?.connected) {
    try {
      const res = await emitWithAck<{
        ok: boolean;
        data?: import("@simbridge/shared").SendMessageResult;
        error?: { message: string };
      }>((cb) =>
        socket.emit(
          "message:new",
          { pairId: entry.pairId, clientMsgId: entry.clientMsgId, payload, sim: entry.sim },
          cb,
        ),
      );
      if (res.ok && res.data) delivered = true;
    } catch {
      /* fall through to REST */
    }
  }

  if (!delivered) {
    // REST fallback — idempotent per (pairId, clientMsgId), safe for retries.
    await api.sendMessage({
      pairId: entry.pairId,
      clientMsgId: entry.clientMsgId,
      payload,
      sim: entry.sim,
    });
  }

  const updated = await storage.updateOutboxEntry(entry.clientMsgId, {
    status: "sent",
    sentAt: Date.now(),
  });
  useMessageStore.setState({ outbox: updated });
}

export const useMessageStore = create<MessageState>((set, get) => ({
  outbox: [],
  inbox: [],
  lastSeq: {},

  async loadLocal() {
    const [outbox, inbox, lastSeq] = await Promise.all([
      storage.getOutbox(),
      storage.getMessageCache(),
      storage.getLastSeq(),
    ]);
    set({ outbox, inbox, lastSeq });
  },

  async enqueueSms({ smsBody, receiverNumber, pairId, receiverPublicKey, sim }) {
    const clientMsgId = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: OutboxEntry = {
      clientMsgId,
      pairId,
      receiverNumber,
      smsBody,
      sim,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    };
    const outbox = [entry, ...(await storage.getOutbox())];
    await storage.setOutbox(outbox);
    set({ outbox });

    try {
      const payload = encrypt(receiverPublicKey, smsBody);
      await deliver(entry, payload);
    } catch (err) {
      const updated = await storage.updateOutboxEntry(clientMsgId, {
        status: "failed",
        error: String(err),
        attempts: entry.attempts + 1,
      });
      set({ outbox: updated });
    }
  },

  async flushOutbox() {
    const outbox = await storage.getOutbox();
    const retryable = outbox.filter((e) => e.status === "pending" || e.status === "failed");
    if (retryable.length === 0) return;

    const pairs = useDeviceStore.getState().pairs;
    for (const entry of retryable) {
      const pair = pairs.find((p) => p.pairId === entry.pairId);
      if (!pair || pair.status !== "active" || !pair.receiverPublicKey) continue;
      try {
        // Re-encrypt from the device-local plaintext stored in the outbox.
        const payload = encrypt(pair.receiverPublicKey, entry.smsBody);
        await deliver(entry, payload);
      } catch (err) {
        const updated = await storage.updateOutboxEntry(entry.clientMsgId, {
          attempts: entry.attempts + 1,
          error: String(err),
        });
        set({ outbox: updated });
      }
    }
  },

  async syncAll() {
    const { pairs, profile } = useDeviceStore.getState();
    const role = profile?.role;
    const active = pairs.filter((p) => p.status === "active");
    if (active.length === 0) return;

    const inbox = [...get().inbox];
    const lastSeq = { ...get().lastSeq };
    let changed = false;

    for (const pair of active) {
      try {
        const after = lastSeq[pair.pairId] ?? 0;
        const res = await api.sync(pair.pairId, after);
        for (const msg of res.messages) {
          if (!inbox.some((m) => m.messageId === msg.messageId)) {
            inbox.push({ ...msg });
            changed = true;
          }
          lastSeq[pair.pairId] = Math.max(lastSeq[pair.pairId] ?? 0, msg.seq);
        }

        if (role === "receiver" && res.messages.length > 0) {
          const ids = res.messages.filter((m) => m.status === "sent").map((m) => m.messageId);
          if (ids.length > 0) await api.ack(ids).catch(() => undefined);
        }

        if (role === "sender" && res.messages.length > 0) {
          // Mirror remote delivery statuses into the local outbox (step 6/7).
          const statusById = new Map(res.messages.map((m) => [m.messageId, m.status]));
          const outbox = await storage.getOutbox();
          let dirty = false;
          for (const entry of outbox) {
            const remote = entry.messageId ? statusById.get(entry.messageId) : undefined;
            if (remote === "delivered" && entry.status !== "delivered") {
              entry.status = "delivered";
              dirty = true;
            }
          }
          if (dirty) {
            await storage.setOutbox(outbox);
            set({ outbox: [...outbox] });
          }
        }
      } catch {
        /* offline — next sync catches up */
      }
    }

    inbox.sort((a, b) => b.seq - a.seq);
    const trimmed = inbox.slice(0, 500);
    set({ inbox: trimmed, lastSeq });
    if (changed) await storage.setMessageCache(trimmed);
    await storage.setLastSeqMap(lastSeq);
  },

  async decryptEntry(entry) {
    if (entry.decrypted) return entry.decrypted;
    const secret = await receiverSecret();
    if (!secret) return "[no key on device]";
    try {
      const text = decrypt(secret, entry.payload);
      const inbox = get().inbox.map((m) =>
        m.messageId === entry.messageId ? { ...m, decrypted: text } : m,
      );
      set({ inbox });
      return text;
    } catch {
      return "[unable to decrypt]";
    }
  },

  async wireRealtime() {
    if (wired) get().unwrapRealtime();
    const socket = await connectSocket();
    const deviceStore = useDeviceStore.getState();

    socket.on("connect", () => {
      void deviceStore.setConnection("online");
      void deviceStore.refreshPairs();
      void get().flushOutbox();
      void get().syncAll();
    });
    socket.on("disconnect", () => {
      void deviceStore.setConnection("offline");
    });
    socket.on("connect_error", () => {
      void deviceStore.setConnection("offline");
    });

    socket.on("message:incoming", (msg: MessageDTO) => {
      const inbox = [
        { ...msg },
        ...get().inbox.filter((m) => m.messageId !== msg.messageId),
      ];
      set({ inbox });
      void storage.setMessageCache(inbox.slice(0, 500));
      void storage.setLastSeqFor(msg.pairId, msg.seq);
      void notify("New message", "You received an encrypted message");
      // Receiver acknowledges instantly (step 6).
      void api.ack([msg.messageId]).catch(() => undefined);
    });

    socket.on("message:delivered", ({ messageId }) => {
      void (async () => {
        const outbox = await storage.getOutbox();
        const next = outbox.map((e) =>
          e.messageId === messageId ? { ...e, status: "delivered" as const } : e,
        );
        await storage.setOutbox(next);
        set({ outbox: next });
      })();
    });

    socket.on("sync:hint", ({ pairId }) => {
      void (async () => {
        const role = useDeviceStore.getState().profile?.role;
        if (role === "receiver") {
          await get().syncAll();
        } else {
          // Sender: mirror delivery statuses for this pair from the backend.
          const res = await api.sync(pairId, 0).catch(() => null);
          if (!res) return;
          const statusById = new Map(res.messages.map((m) => [m.messageId, m.status] as const));
          const outbox = await storage.getOutbox();
          let dirty = false;
          for (const entry of outbox) {
            if (entry.status === "delivered") continue;
            const remote = entry.messageId ? statusById.get(entry.messageId) : undefined;
            if (remote === "delivered") {
              entry.status = "delivered";
              dirty = true;
            }
          }
          if (dirty) {
            await storage.setOutbox(outbox);
            set({ outbox: [...outbox] });
          }
        }
      })();
    });

    socket.on("pairing:accepted", () => {
      void deviceStore.refreshPairs();
    });
    socket.on("pair:revoked", () => {
      void deviceStore.refreshPairs();
    });

    // Native connectivity: flush pending outbox when the network returns.
    const { smsBridge } = await import("../native/sms-bridge");
    unsubFns.push(
      smsBridge.onConnectivityChanged(({ online }) => {
        if (online) void get().flushOutbox();
      }),
    );

    wired = true;
    if (socket.connected) {
      await deviceStore.setConnection("online");
      void get().flushOutbox();
      void get().syncAll();
    }
  },

  unwrapRealtime() {
    const socket = getSocket();
    if (socket) socket.removeAllListeners();
    unsubFns.forEach((u) => u());
    unsubFns = [];
    wired = false;
  },
}));

export type { PairDTO };
