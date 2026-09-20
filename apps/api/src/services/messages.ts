import { Pair } from "../db/models/pair.js";
import type { PairDoc } from "../db/models/pair.js";
import { Message } from "../db/models/message.js";
import type { MessageDoc } from "../db/models/message.js";
import { Device } from "../db/models/device.js";
import { audit } from "../db/models/audit.js";
import { env } from "../config/env.js";
import { newId } from "../utils/ids.js";
import { errors } from "../utils/errors.js";
import { tryGetIo } from "../realtime/io.js";
import { deviceRoom, pairRoom, ENCRYPTION_SCHEME, ENCRYPTION_SCHEME_V1, SocketEvents } from "@simbridge/shared";
import { decodeEnvelopeV1, verifyEnvelopeV1 } from "@simbridge/crypto";
import { CryptoError } from "@simbridge/crypto";
import type {
  AckInput,
  AckResult,
  EncryptedPayload,
  EnvelopePayloadV1,
  ExistsInput,
  ExistsResult,
  MessageDTO,
  MessagePayload,
  Role,
  SendMessageInput,
  SendMessageResult,
  SyncResult,
} from "@simbridge/shared";

/**
 * Validate an incoming payload and, for V1 envelopes, cryptographically verify
 * the sender's Ed25519 signature against the pair's pinned sender key. Returns
 * the opaque payload to store/relay (never plaintext).
 */
function preparePayload(
  payload: unknown,
  pair: Pick<PairDoc, "pairId" | "receiverDeviceId">,
  senderDevice: { deviceId: string; signingPublicKey?: string },
): MessagePayload {
  if (!payload || typeof payload !== "object") throw errors.validation("payload is required");
  const p = payload as Record<string, unknown>;

  // Legacy V0: unversioned ECIES box (no sender signature).
  if (p.scheme === ENCRYPTION_SCHEME) {
    if (p.version !== undefined || p.signature !== undefined) {
      throw errors.validation("Invalid legacy payload: V0 must not carry V1 envelope fields");
    }
    for (const field of ["ciphertext", "ephemPublicKey", "nonce"] as const) {
      const v = p[field];
      if (typeof v !== "string" || v.length < 16 || v.length > 64_000) {
        throw errors.validation(`payload.${field} is missing or has invalid length`);
      }
    }
    return p as unknown as EncryptedPayload;
  }

  // V1 signed envelope.
  if (p.scheme === ENCRYPTION_SCHEME_V1) {
    let envelope: EnvelopePayloadV1;
    try {
      envelope = decodeEnvelopeV1(payload);
    } catch (err) {
      throw errors.validation(err instanceof CryptoError ? err.message : "Invalid V1 envelope");
    }

    // Bind the envelope to THIS pair and THIS authenticated sender — the
    // signature alone doesn't stop an envelope being replayed into another pair.
    if (envelope.pairId !== pair.pairId) {
      throw errors.validation(`envelope.pairId does not match the pair it was sent to (${envelope.pairId} vs ${pair.pairId})`);
    }
    if (envelope.receiverDeviceId !== pair.receiverDeviceId) {
      throw errors.validation("envelope.receiverDeviceId does not match this pair's receiver");
    }
    if (envelope.senderDeviceId !== senderDevice.deviceId) {
      throw errors.forbidden("envelope.senderDeviceId does not match the authenticated sender");
    }
    if (!senderDevice.signingPublicKey) {
      throw errors.validation("The sending device has no registered signing key — cannot verify V1 envelopes");
    }

    let valid = false;
    try {
      valid = verifyEnvelopeV1(envelope, senderDevice.signingPublicKey, envelope.signature);
    } catch {
      valid = false;
    }
    if (!valid) {
      throw errors.invalidSignature("Envelope signature verification failed (sender key mismatch or tampering)");
    }
    return envelope;
  }

  throw errors.validation(`Unknown payload scheme: ${String(p.scheme)}`);
}

/** The envelope's own messageId, when the payload is a V1 envelope. */
function envelopeMessageId(payload: MessagePayload): string | null {
  return payload.scheme === ENCRYPTION_SCHEME_V1 ? (payload as EnvelopePayloadV1).messageId : null;
}

export function toMessageDTO(doc: MessageDoc): MessageDTO {
  return {
    messageId: doc.messageId,
    pairId: doc.pairId,
    roomId: doc.roomId,
    senderDeviceId: doc.senderDeviceId,
    clientMsgId: doc.clientMsgId,
    seq: doc.seq,
    from: doc.from,
    fromName: doc.fromName,
    payload: doc.payload,
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
  const pair = await assertActiveSender(input.pairId, device.deviceId);

  const senderDevice = await Device.findOne({ deviceId: device.deviceId }).lean();
  const payload = preparePayload(input.payload, pair, {
    deviceId: device.deviceId,
    signingPublicKey: senderDevice?.signingPublicKey,
  });

  // For V1 envelopes, keep the pair pin in lockstep with the sender's key. A
  // rotation clears the receiver's confirmation so they must re-verify before
  // V1 resumes (the old pin would still be reported to them otherwise).
  if (payload.scheme === ENCRYPTION_SCHEME_V1) {
    const env = payload as EnvelopePayloadV1;
    if (
      pair.pinnedSenderSignKey !== senderDevice?.signingPublicKey ||
      pair.pinnedSenderSignKeyFingerprint !== senderDevice?.signingKeyFingerprint
    ) {
      await Pair.updateOne(
        { pairId: pair.pairId, status: "active" },
        {
          $set: {
            pinnedSenderSignKey: senderDevice?.signingPublicKey,
            pinnedSenderSignKeyFingerprint: senderDevice?.signingKeyFingerprint,
            receiverFingerprintConfirmed: false,
          },
        },
      );
    }
  }

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

  // Replay protection: a V1 envelope carries its own signed messageId which must
  // be unique within the pair — prevents replaying the same signed envelope with
  // a different clientMsgId.
  const envMessageId = envelopeMessageId(payload);
  if (envMessageId) {
    const replay = await Message.findOne({
      pairId: input.pairId,
      "payload.messageId": envMessageId,
    }).lean<MessageDoc>();
    if (replay) {
      return {
        messageId: replay.messageId,
        pairId: replay.pairId,
        seq: replay.seq,
        status: replay.status,
        deduplicated: true,
      };
    }
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
      payload,
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
  const io = tryGetIo();
  io?.to(deviceRoom(pair.receiverDeviceId)).emit(SocketEvents.MESSAGE_INCOMING, dto);
  audit("message.received", {
    deviceId: device.deviceId,
    pairId: pair.pairId,
    meta: {
      seq,
      scheme: payload.scheme,
      ciphertextBytes:
        "ciphertext" in payload ? payload.ciphertext.length : 0,
    },
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

    const io = tryGetIo();
    for (const m of delivered) {
      io?.to(pairRoom(m.roomId)).emit(SocketEvents.MESSAGE_DELIVERED, {
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
