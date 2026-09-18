/**
 * SIMBridge end-to-end smoke test.
 *
 * Simulates the full feature flow against a running API + local MongoDB:
 *   1. Device registration (sender + receiver, with key pairs)
 *   2. Role selection / pairing request  -> receiver notified in real time
 *   3. Receiver accepts                  -> pair room created, both auto-join
 *   4. Sender sends an ENCRYPTED message -> receiver decrypts + acknowledges
 *   5. Sender receives delivery receipt
 *   6. Offline handling: receiver drops; REST ingestion keeps working;
 *      messages sync back on reconnect (lastSeq cursor)
 *
 * Usage: pnpm --filter @simbridge/api smoke   (API must be running)
 */
import { io, Socket } from "socket.io-client";
import { SocketEvents, type ClientToServerEvents, type ServerToClientEvents } from "@simbridge/shared";
import { generateKeyPair, encrypt, decrypt } from "@simbridge/crypto";
import { connectMongo, disconnectMongo } from "../src/db/mongo.js";
import { Device } from "../src/db/models/device.js";
import { Pair } from "../src/db/models/pair.js";
import { Message } from "../src/db/models/message.js";
import { SimSubscription } from "../src/db/models/sim.js";
import { AuditLog } from "../src/db/models/audit.js";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const TEST_NAMES = ["+8801700000001", "+8801700000002"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cleanupTestData(): Promise<void> {
  // Make every run idempotent: drop the fixed test devices from previous runs.
  await connectMongo();
  const devices = await Device.find({ name: { $in: TEST_NAMES } })
    .select("deviceId")
    .lean<{ deviceId: string }[]>();
  const deviceIds = devices.map((d) => d.deviceId);
  const pairs = await Pair.find({
    $or: [{ senderDeviceId: { $in: deviceIds } }, { receiverDeviceId: { $in: deviceIds } }],
  }).lean<{ pairId: string }[]>();
  const pairIds = pairs.map((p) => p.pairId);
  await Promise.all([
    Message.deleteMany({ pairId: { $in: pairIds } }),
    Message.deleteMany({ senderDeviceId: { $in: deviceIds } }),
    Message.deleteMany({ receiverDeviceId: { $in: deviceIds } }),
    Pair.deleteMany({ senderDeviceId: { $in: deviceIds } }),
    Pair.deleteMany({ receiverDeviceId: { $in: deviceIds } }),
    SimSubscription.deleteMany({ deviceId: { $in: deviceIds } }),
    AuditLog.deleteMany({ deviceId: { $in: deviceIds } }),
    AuditLog.deleteMany({ pairId: { $in: pairIds } }),
    Device.deleteMany({ deviceId: { $in: deviceIds } }),
  ]);
  console.log(`  [i] cleaned ${devices.length} leftover test device(s)`);
}

let failures = 0;
function check(name: string, cond: boolean, extra = ""): void {
  const mark = cond ? "PASS" : "FAIL";
  if (!cond) failures++;
  console.log(`  [${mark}] ${name}${extra ? ` — ${extra}` : ""}`);
}

// Single-slot capture for SYNC_HINT events, attached at socket creation time
// so we never miss the server's connection-time hint (race-free).
let hintResolver: ((p: { pairId: string; pendingCount?: number }) => void) | null = null;
function nextSyncHint(): Promise<{ pairId: string; pendingCount?: number }> {
  return new Promise((resolve) => {
    hintResolver = resolve;
  });
}

interface Res<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function api<T>(
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<Res<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  return (await res.json()) as Res<T>;
}

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

function connect(token: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const socket: Client = io(BASE, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 8000,
    });
    socket.on(SocketEvents.SYNC_HINT, (p) => {
      if (hintResolver) {
        hintResolver(p);
        hintResolver = null;
      }
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(new Error(`connect_error: ${err.message}`)));
  });
}

function emitAck<Res>(
  socket: Client,
  event: Parameters<Client["emit"]>[0],
  payload: unknown,
  timeoutMs = 8000,
): Promise<Res> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ack timeout for ${String(event)}`)), timeoutMs);
    (socket as unknown as Socket).emit(event as string, payload, (res: Res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

async function main() {
  console.log(`SIMBridge smoke test -> ${BASE}\n`);

  // 0) Clean leftover test data from previous runs, then health
  await cleanupTestData();
  const health = await api<{ status: string; mongo: string }>("/health");
  check("health endpoint", health.ok === true && health.data?.status === "healthy", `mongo=${health.data?.mongo}`);
  if (!health.ok) process.exit(1);

  // 1) Device registration with key pairs
  const senderKeys = generateKeyPair();
  const receiverKeys = generateKeyPair();

  const senderReg = await api<{ deviceId: string; apiKey: string; accessToken: string }>("/auth/register", {
    method: "POST",
    body: { name: "+8801700000001", role: "sender", publicKey: senderKeys.publicKey, platform: "android" },
  });
  const receiverReg = await api<{ deviceId: string; apiKey: string; accessToken: string }>("/auth/register", {
    method: "POST",
    body: { name: "+8801700000002", role: "receiver", publicKey: receiverKeys.publicKey, platform: "android" },
  });
  check("sender registered", senderReg.ok === true && !!senderReg.data?.deviceId);
  check("receiver registered", receiverReg.ok === true && !!receiverReg.data?.deviceId);
  if (!senderReg.ok || !receiverReg.ok) process.exit(1);

  const senderId = senderReg.data!.deviceId;
  const receiverId = receiverReg.data!.deviceId;
  const senderToken = senderReg.data!.accessToken;
  const receiverToken = receiverReg.data!.accessToken;

  // Token refresh path — MUST run before any re-register/reclaim, because a
  // reclaim rotates the apiKey and invalidates the original one for /auth/token.
  const refreshed = await api<{ accessToken: string }>("/auth/token", {
    method: "POST",
    body: { deviceId: senderId, apiKey: senderReg.data!.apiKey },
  });
  check("apiKey -> token exchange", refreshed.ok === true && !!refreshed.data?.accessToken);

  // Re-registering an existing phone reclaims the same device (idempotent
  // after a local wipe) — deviceId preserved, apiKey rotated, role canonical.
  const dupReg = await api<{ deviceId: string; apiKey: string; role: string }>("/auth/register", {
    method: "POST",
    body: { name: "+8801700000001", role: "sender", publicKey: senderKeys.publicKey, platform: "android" },
  });
  check(
    "re-register reclaims the same device (idempotent)",
    dupReg.ok === true && dupReg.data?.deviceId === senderId && dupReg.data?.role === "sender",
    dupReg.error?.message,
  );

  const staleKey = await api("/auth/token", {
    method: "POST",
    body: { deviceId: senderId, apiKey: senderReg.data!.apiKey },
  });
  check("reclaim rotates apiKey (old key rejected)", staleKey.ok === false, staleKey.error?.message);

  const rotatedKey = await api<{ accessToken: string }>("/auth/token", {
    method: "POST",
    body: { deviceId: senderId, apiKey: dupReg.data!.apiKey },
  });
  check("rotated apiKey -> token exchange", rotatedKey.ok === true && !!rotatedKey.data?.accessToken);

  const badName = await api("/auth/register", {
    method: "POST",
    body: { name: "not a phone", role: "sender", publicKey: senderKeys.publicKey, platform: "android" },
  });
  check("non-phone name rejected", badName.ok === false, badName.error?.message);

  // SIM registry
  const sims = await api("/me/sims", {
    method: "PUT",
    token: senderToken,
    body: {
      sims: [
        { subscriptionId: 0, carrierName: "SmokeTel", slotIndex: 0, displayName: "SIM 1", phoneNumber: "+8801700000001" },
        { subscriptionId: 1, carrierName: "SmokeCell", slotIndex: 1, displayName: "SIM 2", phoneNumber: "+8801700000002" },
      ],
    },
  });
  check("SIM registry (multi-SIM)", sims.ok === true && Array.isArray((sims.data as unknown as unknown[])) && (sims.data as unknown as unknown[]).length === 2);

  // 2) Sockets connect
  const senderSock = await connect(senderToken);
  const receiverSock = await connect(receiverToken);
  check("sender socket connected (JWT handshake)", senderSock.connected);
  check("receiver socket connected (JWT handshake)", receiverSock.connected);

  const pairingIncoming = new Promise<{ pairId: string; code: string }>((resolve) => {
    receiverSock.on(SocketEvents.PAIRING_INCOMING, (p) => resolve({ pairId: p.pairId, code: p.code }));
  });
  const pairingAccepted = new Promise<{ pairId: string; roomId: string }>((resolve) => {
    senderSock.on(SocketEvents.PAIRING_ACCEPTED, (p) => resolve(p));
  });
  const incoming = new Promise<{ messageId: string; pairId: string; seq: number; payload: unknown }>((resolve) => {
    receiverSock.on(SocketEvents.MESSAGE_INCOMING, (p) => resolve(p));
  });
  const delivered = new Promise<{ messageId: string }>((resolve) => {
    senderSock.on(SocketEvents.MESSAGE_DELIVERED, (p) => resolve(p));
  });

  // 3) Pairing request (step 3)
  const pair = await api<{ pairId: string; code: string; receiverOnline: boolean }>("/pairs", {
    method: "POST",
    token: senderToken,
    body: { receiverDeviceId: receiverId },
  });
  check("pairing request created", pair.ok === true && /^\d{6}$/.test(pair.data?.code ?? ""), `receiverOnline=${pair.data?.receiverOnline}`);

  const notified = await pairingIncoming;
  check("receiver notified in real time", notified.pairId === pair.data!.pairId && notified.code === pair.data!.code);

  // 4) Receiver accepts
  const accepted = await api<{ pairId: string; roomId: string; senderPublicKey: string }>("/pairs/accept/" + pair.data!.code, {
    method: "POST",
    token: receiverToken,
  });
  check("receiver accepted pairing", accepted.ok === true && !!accepted.data?.roomId);
  const acceptedEvt = await pairingAccepted;
  check("sender notified of acceptance", acceptedEvt.roomId === accepted.data!.roomId);

  const pairId = pair.data!.pairId;

  // 5) Encrypted send over Socket.IO (steps 4-6)
  const plaintext = "OTP 482913 from SmokeTel — e2e works!";
  const payload = encrypt(receiverKeys.publicKey, plaintext);
  const sent = await emitAck<{ ok: boolean; data?: { messageId: string; seq: number; deduplicated: boolean }; error?: { message: string } }>(
    senderSock,
    SocketEvents.MESSAGE_NEW as unknown as Parameters<Client["emit"]>[0],
    { pairId, clientMsgId: "smoke-" + Date.now(), payload, sim: { subscriptionId: 1, carrierName: "SmokeCell", slotIndex: 1 } },
  );
  check("message accepted with ack", sent.ok === true && !!sent.data?.messageId, `seq=${sent.data?.seq} dedup=${sent.data?.deduplicated}`);

  const got = await incoming;
  const decrypted = decrypt(receiverKeys.secretKey, got.payload as Parameters<typeof decrypt>[1]);
  check("receiver decrypted E2E payload", decrypted === plaintext, `plaintext="${decrypted}"`);

  // 6) Acknowledgement -> delivery receipt
  const acked = await emitAck<{ ok: boolean; data?: { updated: number } }>(
    receiverSock,
    SocketEvents.MESSAGE_ACK as unknown as Parameters<Client["emit"]>[0],
    { messageIds: [got.messageId] },
  );
  check("receiver acknowledged", acked.ok === true && acked.data?.updated === 1);
  const receipt = await delivered;
  check("sender got delivery receipt", receipt.messageId === got.messageId);

  // 7) REST sync (step 7)
  const sync = await api<{ messages: Array<{ seq: number; messageId: string }> }>("/messages/sync?pairId=" + pairId + "&afterSeq=0", {
    token: receiverToken,
  });
  check("REST sync returns messages", sync.ok === true && sync.data!.messages.length === 1 && sync.data!.messages[0].seq === 1);

  // 8) Offline handling (step 5): receiver drops, REST keeps ingesting.
  // NOTE: same clientMsgId for both calls — exercises idempotent dedup.
  const sharedClientMsgId = "offline-1-" + Date.now();
  receiverSock.disconnect();
  await sleep(300);

  const offline1 = await api<{ messageId: string; seq: number }>("/messages", {
    method: "POST",
    token: senderToken,
    body: { pairId, clientMsgId: sharedClientMsgId, payload: encrypt(receiverKeys.publicKey, "offline message #1") },
  });
  const offline2 = await api<{ messageId: string; seq: number; deduplicated: boolean }>("/messages", {
    method: "POST",
    token: senderToken,
    body: { pairId, clientMsgId: sharedClientMsgId, payload: encrypt(receiverKeys.publicKey, "duplicate clientMsgId") },
  });
  check("REST ingestion while receiver offline", offline1.ok === true && offline1.data?.seq === 2);
  check("idempotent dedup on same clientMsgId", offline2.ok === true && offline2.data?.deduplicated === true && offline2.data?.seq === 2);

  const exists = await api<{ existing: string[] }>("/messages/exists", {
    method: "POST",
    token: senderToken,
    body: { pairId, clientMsgIds: [sharedClientMsgId, "not-stored-" + Date.now()] },
  });
  check(
    "exists pre-check reports stored clientMsgId",
    exists.ok === true && exists.data?.existing.length === 1 && exists.data?.existing[0] === sharedClientMsgId,
  );

  // 9) Reconnect -> sync hint -> fetch missed messages
  const hintPromise = nextSyncHint();
  const receiverSock2 = await connect(receiverToken);
  const hint = await Promise.race([hintPromise, sleep(3000).then(() => null)]);
  check("sync hint on reconnect", hint !== null && hint.pairId === pairId, hint ? `pending=${hint.pendingCount}` : "no hint");

  const missed = await emitAck<{ ok: boolean; data?: { messages: Array<{ seq: number; payload: unknown }> } }>(
    receiverSock2,
    SocketEvents.SYNC_FETCH as unknown as Parameters<Client["emit"]>[0],
    { pairId, afterSeq: 1, limit: 100 },
  );
  check("socket sync after lastSeq=1 returns 1 missed message", missed.ok === true && missed.data!.messages.length === 1);
  if (missed.ok) {
    const text = decrypt(receiverKeys.secretKey, missed.data!.messages[0].payload as Parameters<typeof decrypt>[1]);
    check("missed message decrypts correctly", text === "offline message #1", `plaintext="${text}"`);
  }

  // 10) Auth guards
  const noAuth = await api("/pairs");
  check("unauthenticated request rejected", noAuth.ok === false && noAuth.error?.code === "AUTH_REQUIRED");
  const badRole = await api("/pairs", { method: "POST", token: receiverToken, body: { receiverDeviceId: senderId } });
  check("receiver cannot create pairing request", badRole.ok === false && badRole.error?.code === "FORBIDDEN");

  senderSock.close();
  receiverSock2.close();

  await disconnectMongo();
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED ✓" : failures + " CHECK(S) FAILED ✗"}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  await disconnectMongo().catch(() => undefined);
  console.error("\nSMOKE TEST CRASHED:", err);
  process.exit(1);
});
