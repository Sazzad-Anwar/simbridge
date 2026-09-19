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
// Polyfill before @simbridge/crypto (tweetnacl captures its PRNG at module load).
import "../lib/random-polyfill";
import { decrypt, encrypt } from "@simbridge/crypto";
import { secrets, storage, type OutboxEntry } from "../lib/storage";
import { api } from "../lib/api";
import { connectSocket, getSocket, emitWithAck } from "../lib/socket";
import { useDeviceStore } from "./device-store";
import { notify } from "../lib/notifications";
import { smsClientMsgId } from "../native/sms-bridge";

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
    fromName?: string;
    pairId: string;
    receiverPublicKey: string;
    sim: OutboxEntry["sim"];
    clientMsgId?: string;
  }) => Promise<void>;

  /** Step 5 — retry PENDING/FAILED outbox entries (reconnect / app start). */
  flushOutbox: () => Promise<void>;

  /** Drain the native encrypted outbox (SMS persisted while JS was dead). */
  drainNativeOutbox: () => Promise<void>;

  /** Scan the OS SMS inbox for messages missed while the app was dead, then forward. */
  reconcileInbox: () => Promise<void>;

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
          {
            pairId: entry.pairId,
            clientMsgId: entry.clientMsgId,
            payload,
            sim: entry.sim,
            from: entry.receiverNumber,
            fromName: entry.fromName,
          },
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
      from: entry.receiverNumber,
      fromName: entry.fromName,
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

  async enqueueSms({ smsBody, receiverNumber, fromName, pairId, receiverPublicKey, sim, clientMsgId = "" }) {
    const id = clientMsgId || smsClientMsgId({
      pairId,
      body: smsBody,
      sender: receiverNumber,
      timestamp: Date.now(),
      subscriptionId: sim?.subscriptionId,
    });
    const existing = await storage.getOutbox();
    if (existing.some((e) => e.clientMsgId === id)) return;
    const entry: OutboxEntry = {
      clientMsgId: id,
      pairId,
      receiverNumber,
      fromName,
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
      const updated = await storage.updateOutboxEntry(id, {
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

  async drainNativeOutbox() {
    const { smsBridge } = await import("../native/sms-bridge");
    const native = smsBridge.getOutbox();
    if (native.length === 0) return;
    console.log("[smsbridge] drain: got", native.length, "native entries");

    const { pairs } = useDeviceStore.getState();
    const active = pairs.find((p) => p.status === "active" && p.receiverPublicKey);
    if (!active?.receiverPublicKey) return; // no paired receiver yet — keep native entries

    const existing = await storage.getOutbox();
    const known = new Set(existing.map((e) => e.clientMsgId));

    const candidates: {
      body: string;
      sender: string;
      clientMsgId: string;
      raw: (typeof native)[number];
    }[] = [];
    for (const raw of native) {
      const body = raw.body?.trim();
      const sender = raw.originatingAddress?.trim();
      if (!body || !sender) continue;
      const clientMsgId = smsClientMsgId({
        pairId: active.pairId,
        body,
        sender,
        timestamp: raw.timestamp ?? 0,
        subscriptionId: raw.subscriptionId,
      });
      if (known.has(clientMsgId)) continue;
      known.add(clientMsgId);
      candidates.push({ body, sender, clientMsgId, raw });
    }

    if (candidates.length > 0) {
      try {
        const { existing: stored } = await api.checkExists(
          active.pairId,
          candidates.map((c) => c.clientMsgId),
        );
        if (stored.length > 0) {
          const storedSet = new Set(stored);
          const kept = candidates.filter((c) => !storedSet.has(c.clientMsgId));
          console.log(
            "[smsbridge] drain: skipped",
            candidates.length - kept.length,
            "already in DB",
          );
          candidates.length = 0;
          candidates.push(...kept);
        }
      } catch (err) {
        console.log("[smsbridge] drain: exists pre-check failed", String(err));
      }
    }

    let forwarded = 0;
    for (const c of candidates) {
      await get().enqueueSms({
        smsBody: c.body,
        receiverNumber: c.sender,
        fromName: c.raw.contactName,
        pairId: active.pairId,
        receiverPublicKey: active.receiverPublicKey,
        clientMsgId: c.clientMsgId,
        sim: {
          subscriptionId: c.raw.subscriptionId ?? 0,
          carrierName: c.raw.simDisplayName ?? "SIM",
          displayName: c.raw.simDisplayName,
        },
      });
      forwarded++;
    }

    console.log("[smsbridge] drain: forwarded", forwarded, "of", native.length);
    // The JS outbox is now the authoritative record (it retains sent entries),
    // so the native mirror can be dropped once snapshot has been reconciled.
    smsBridge.clearOutbox();
  },

  async reconcileInbox() {
    const { smsBridge } = await import("../native/sms-bridge");
    let after = await storage.getSmsWatermark();
    if (after == null) {
      // First run: never forward pre-existing SMS history — anchor the scan at
      // "now" and only recover messages that arrive from this point on.
      after = Date.now();
      await storage.setSmsWatermark(after);
    }
    console.log("[smsbridge] reconcileInbox: after=", after);

    const native = await smsBridge.readRecentInbox(after, 200);
    console.log("[smsbridge] reconcileInbox: scan returned", native.length);
    if (native.length === 0) return;

    const { pairs } = useDeviceStore.getState();
    const active = pairs.find((p) => p.status === "active" && p.receiverPublicKey);
    if (!active?.receiverPublicKey) return; // no paired receiver yet — keep watermark so we retry

    const existing = await storage.getOutbox();
    const known = new Set(existing.map((e) => e.clientMsgId));

    const candidates: {
      body: string;
      sender: string;
      clientMsgId: string;
      timestamp: number;
      subscriptionId: number;
    }[] = [];
    let maxTs = after;
    for (const raw of native) {
      if (raw.timestamp != null && raw.timestamp > maxTs) maxTs = raw.timestamp;
      const body = raw.body?.trim();
      const sender = raw.originatingAddress?.trim();
      if (!body || !sender) continue;
      const clientMsgId = smsClientMsgId({
        pairId: active.pairId,
        body,
        sender,
        timestamp: raw.timestamp ?? 0,
        subscriptionId: raw.subscriptionId ?? 0,
      });
      if (known.has(clientMsgId)) continue;
      known.add(clientMsgId);
      candidates.push({
        body,
        sender,
        clientMsgId,
        timestamp: raw.timestamp ?? 0,
        subscriptionId: raw.subscriptionId ?? 0,
      });
    }

    if (candidates.length > 0) {
      try {
        const { existing: storedDup } = await api.checkExists(
          active.pairId,
          candidates.map((c) => c.clientMsgId),
        );
        if (storedDup.length > 0) {
          const storedSet = new Set(storedDup);
          const kept = candidates.filter((c) => !storedSet.has(c.clientMsgId));
          console.log(
            "[smsbridge] reconcileInbox: skipped",
            candidates.length - kept.length,
            "already in DB",
          );
          candidates.length = 0;
          candidates.push(...kept);
        }
      } catch (err) {
        console.log("[smsbridge] reconcileInbox: exists pre-check failed", String(err));
      }
    }

    let forwarded = 0;
    for (const c of candidates) {
      await get().enqueueSms({
        smsBody: c.body,
        receiverNumber: c.sender,
        pairId: active.pairId,
        receiverPublicKey: active.receiverPublicKey,
        clientMsgId: c.clientMsgId,
        sim: {
          subscriptionId: c.subscriptionId,
          carrierName: "SIM",
          displayName: "SIM",
        },
      });
      forwarded++;
    }

    console.log("[smsbridge] reconcileInbox: forwarded", forwarded, "of", native.length);
    await storage.setSmsWatermark(maxTs);
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
        let after = lastSeq[pair.pairId] ?? 0;
        const pageSize = 200;
        const fetched: import("@simbridge/shared").MessageDTO[] = [];
        do {
          const res = await api.sync(pair.pairId, after, pageSize);
          fetched.push(...res.messages);
          after = res.lastSeq;
          for (const msg of res.messages) {
            if (!inbox.some((m) => m.messageId === msg.messageId)) {
              inbox.push({ ...msg });
              changed = true;
            }
            lastSeq[pair.pairId] = Math.max(lastSeq[pair.pairId] ?? 0, msg.seq);
          }
          if (!res.hasMore) break;
          if (res.messages.length === 0) break;
        } while (true);

        if (role === "receiver" && fetched.length > 0) {
          const ids = fetched.filter((m) => m.status === "sent").map((m) => m.messageId);
          if (ids.length > 0) await api.ack(ids).catch(() => undefined);
        }

        if (role === "sender" && fetched.length > 0) {
          // Mirror remote delivery statuses into the local outbox (step 6/7).
          const statusById = new Map(fetched.map((m) => [m.messageId, m.status]));
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
      void deviceStore.refreshPairs().then(() => {
        const isSender = useDeviceStore.getState().profile?.role === "sender";
        void get().flushOutbox();
        if (isSender) {
          void get().drainNativeOutbox();
          void get().reconcileInbox();
        }
      });
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

    socket.on("pairing:incoming", () => {
      void deviceStore.refreshPairs();
    });
    socket.on("pairing:accepted", () => {
      void deviceStore.refreshPairs();
      void get().flushOutbox();
      const role = useDeviceStore.getState().profile?.role;
      if (role === "sender") {
        void get().drainNativeOutbox();
        void get().reconcileInbox();
      } else {
        void get().syncAll();
      }
    });
    socket.on("pair:revoked", () => {
      void deviceStore.refreshPairs();
    });

    // Native connectivity: flush pending outbox when the network returns.
    const { smsBridge } = await import("../native/sms-bridge");
    unsubFns.push(
      smsBridge.onConnectivityChanged(({ online }) => {
        if (online) {
          void get().flushOutbox();
          const role = useDeviceStore.getState().profile?.role;
          if (role === "sender") {
            void get().drainNativeOutbox();
            void get().reconcileInbox();
          }
        }
      }),
    );

    wired = true;
    if (socket.connected) {
      await deviceStore.setConnection("online");
      await deviceStore.refreshPairs();
      void get().flushOutbox();
      const role = useDeviceStore.getState().profile?.role;
      if (role === "sender") {
        void get().drainNativeOutbox();
        void get().reconcileInbox();
      }
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
