import { Pair } from "../db/models/pair.js";
import { Message } from "../db/models/message.js";
import type { MessageDoc } from "../db/models/message.js";
import { audit } from "../db/models/audit.js";
import { env } from "../config/env.js";
import { newId } from "../utils/ids.js";
import { errors } from "../utils/errors.js";
import { getIo } from "../realtime/io.js";
import { deviceRoom, pairRoom, ENCRYPTION_SCHEME, SocketEvents } from "@simbridge/shared";
import type {
  AckInput,
  AckResult,
  EncryptedPayload,
  ExistsInput,
  ExistsResult,
  MessageDTO,
  Role,
  SendMessageInput,
  SendMessageResult,
  SyncResult,
} from "@simbridge/shared";

function assertPayload(payload: EncryptedPayload): void {
  if (!payload || typeof payload !== "object") throw errors.validation("payload is required");
  if (payload.scheme !== ENCRYPTION_SCHEME) {
    throw errors.validation(`payload.scheme must be "${ENCRYPTION_SCHEME}"`);
  }
  for (const field of ["ciphertext", "ephemPublicKey", "nonce"] as const) {
    const v = payload[field];
    if (typeof v !== "string" || v.length < 16 || v.length > 64_000) {
      throw errors.validation(`payload.${field} is missing or has invalid length`);
    }
  }
}

export function toMessageDTO(doc: MessageDoc): MessageDTO {
  const { ciphertext, ephemPublicKey, nonce, scheme } = doc.payload;
  return {
    messageId: doc.messageId,
    pairId: doc.pairId,
    roomId: doc.roomId,
    senderDeviceId: doc.senderDeviceId,
    clientMsgId: doc.clientMsgId,
    seq: doc.seq,
    from: doc.from,
    fromName: doc.fromName,
    payload: {
      ciphertext,
      ephemPublicKey,
      nonce,
      scheme: scheme as typeof ENCRYPTION_SCHEME,
    },
    sim:
      doc.sim?.subscriptionId !== undefined
        ? {
            subscriptionId: doc.sim.subscriptionId,
            carrierName: doc.sim.carrierName,
            slotIndex: doc.sim.slotIndex,
            displayName: doc.sim.displayName,
            phoneNumber: doc.sim.phoneNumber,
          }
        : undefined,
    status: doc.status,
    createdAt: doc.createdAt?.toISOString?.() ?? new Date(0).toISOString(),
    deliveredAt: doc.deliveredAt?.toISOString?.(),
  };
}

async function assertActiveSender(pairId: string, deviceId: string) {
  const pair = await Pair.findOne({ pairId }).lean();
  if (!pair) throw errors.pairNotFound();
  if (pair.status !== "active") throw errors.forbidden("Pair is not active");
  if (pair.senderDeviceId !== deviceId) {
    throw errors.forbidden("Only the sender device of this pair can send messages");
  }
  return pair;
}

/**
 * Steps 4-6 of the feature flow: ingest an ENCRYPTED message, persist it,
 * then fan out in real time to the receiver's device room.
 * The backend never sees plaintext — payload stays opaque.
 */
export async function sendMessage(
  device: { deviceId: string; role: Role },
  input: SendMessageInput,
): Promise<SendMessageResult> {
  if (!input?.pairId || !input?.clientMsgId) throw errors.validation("pairId and clientMsgId are required");
  assertPayload(input.payload);
  const pair = await assertActiveSender(input.pairId, device.deviceId);

  // Idempotency: retries (offline outbox) with the same clientMsgId are safe.
  const existing = await Message.findOne({
    pairId: input.pairId,
    clientMsgId: input.clientMsgId,
  }).lean<MessageDoc>();
  if (existing) {
    return {
      messageId: existing.messageId,
      pairId: existing.pairId,
      seq: existing.seq,
      status: existing.status,
      deduplicated: true,
    };
  }

  // Atomically allocate the per-pair sequence number.
  const updatedPair = await Pair.findOneAndUpdate(
    { pairId: pair.pairId, status: "active" },
    { $inc: { seq: 1 } },
    { new: true },
  ).lean<{ seq: number } | null>();
  const seq = updatedPair?.seq ?? 1;

  let doc;
  try {
    doc = await Message.create({
      messageId: newId("msg"),
      pairId: pair.pairId,
      roomId: pair.roomId,
      senderDeviceId: device.deviceId,
      receiverDeviceId: pair.receiverDeviceId,
      clientMsgId: input.clientMsgId,
      seq,
      from: input.from,
      fromName: input.fromName,
      payload: {
        ciphertext: input.payload.ciphertext,
        ephemPublicKey: input.payload.ephemPublicKey,
        nonce: input.payload.nonce,
        scheme: input.payload.scheme,
      },
      sim: input.sim
        ? {
            subscriptionId: input.sim.subscriptionId,
            carrierName: input.sim.carrierName,
            slotIndex: input.sim.slotIndex,
            displayName: input.sim.displayName,
            phoneNumber: input.sim.phoneNumber,
          }
        : undefined,
      status: "sent",
      expiresAt: new Date(Date.now() + env.messageTtlDays * 86_400_000),
    });
  } catch (err) {
    // Concurrent offline-retry burst: another attempt won the unique index
    // (pairId, clientMsgId) race — treat as deduplicated instead of a 500.
    if (
      err &&
      typeof err === "object" &&
      (err as { code?: number }).code === 11000
    ) {
      const existing = await Message.findOne({
        pairId: input.pairId,
        clientMsgId: input.clientMsgId,
      }).lean<MessageDoc>();
      if (existing) {
        return {
          messageId: existing.messageId,
          pairId: existing.pairId,
          seq: existing.seq,
          status: existing.status,
          deduplicated: true,
        };
      }
    }
    throw err;
  }

  const dto = toMessageDTO(doc.toObject() as MessageDoc);

  // Real-time delivery to every socket of the receiver device.
  const io = getIo();
  io.to(deviceRoom(pair.receiverDeviceId)).emit(SocketEvents.MESSAGE_INCOMING, dto);
  audit("message.received", {
    deviceId: device.deviceId,
    pairId: pair.pairId,
    meta: { seq, ciphertextBytes: input.payload.ciphertext.length },
  });

  return { messageId: dto.messageId, pairId: dto.pairId, seq, status: "sent", deduplicated: false };
}

/** Receiver acknowledges delivery -> sender gets MESSAGE_DELIVERED in the pair room. */
export async function acknowledgeMessages(
  device: { deviceId: string },
  input: AckInput,
): Promise<AckResult> {
  const ids = (input?.messageIds ?? []).filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return { updated: 0 };

  const result = await Message.updateMany(
    {
      messageId: { $in: ids },
      receiverDeviceId: device.deviceId,
      status: "sent",
    },
    { $set: { status: "delivered", deliveredAt: new Date(), deliveredTo: device.deviceId } },
  );

  if (result.modifiedCount > 0) {
    const delivered = await Message.find({
      messageId: { $in: ids },
      receiverDeviceId: device.deviceId,
      status: "delivered",
    })
      .select("messageId pairId roomId deliveredAt")
      .lean<Array<{ messageId: string; pairId: string; roomId: string; deliveredAt: Date }>>();

    const io = getIo();
    for (const m of delivered) {
      io.to(pairRoom(m.roomId)).emit(SocketEvents.MESSAGE_DELIVERED, {
        messageId: m.messageId,
        pairId: m.pairId,
        deliveredAt: m.deliveredAt?.toISOString?.() ?? new Date().toISOString(),
        byDeviceId: device.deviceId,
      });
    }
    audit("message.delivered", { deviceId: device.deviceId, meta: { count: result.modifiedCount } });
  }
  return { updated: result.modifiedCount };
}

/** Step 7: fetch missed messages after a sequence number (app start / reconnect). */
export async function syncMessages(
  device: { deviceId: string },
  input: { pairId: string; afterSeq: number; limit?: number },
): Promise<SyncResult> {
  const pair = await Pair.findOne({ pairId: input.pairId }).lean();
  if (!pair) throw errors.pairNotFound();
  if (pair.senderDeviceId !== device.deviceId && pair.receiverDeviceId !== device.deviceId) {
    throw errors.forbidden("You are not a participant of this pair");
  }

  const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);
  const afterSeq = Number.isFinite(input.afterSeq) ? Math.max(0, input.afterSeq) : 0;

  const docs = await Message.find({ pairId: input.pairId, seq: { $gt: afterSeq } })
    .sort({ seq: 1 })
    .limit(limit + 1)
    .lean<MessageDoc[]>();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const lastSeq = page.length > 0 ? page[page.length - 1].seq : afterSeq;

  return { messages: page.map(toMessageDTO), hasMore, lastSeq };
}

/** Return which clientMsgIds already exist in a pair — used by senders to skip re-sending. */
export async function checkClientMsgIdsExist(
  device: { deviceId: string },
  input: ExistsInput,
): Promise<ExistsResult> {
  const pair = await Pair.findOne({ pairId: input.pairId }).lean();
  if (!pair) throw errors.pairNotFound();
  if (pair.senderDeviceId !== device.deviceId && pair.receiverDeviceId !== device.deviceId) {
    throw errors.forbidden("You are not a participant of this pair");
  }
  const docs = await Message.find({
    pairId: input.pairId,
    clientMsgId: { $in: input.clientMsgIds },
  })
    .select("clientMsgId")
    .lean<Array<{ clientMsgId: string }>>();
  return { existing: docs.map((d) => d.clientMsgId) };
}
