import type { PairDoc } from "../db/models/pair.js";
import { Pair } from "../db/models/pair.js";
import type { DeviceDoc } from "../db/models/device.js";
import { Device } from "../db/models/device.js";
import { SimSubscription } from "../db/models/sim.js";
import { audit } from "../db/models/audit.js";
import { env } from "../config/env.js";
import { newId, newPairingCode } from "../utils/ids.js";
import { errors } from "../utils/errors.js";
import { isDeviceOnline, tryGetIo } from "../realtime/io.js";
import { deviceRoom, pairRoom, SocketEvents } from "@simbridge/shared";
import type {
  AcceptPairResult,
  CreatePairResult,
  DeviceDTO,
  PairDTO,
  Role,
  SimInfo,
} from "@simbridge/shared";
import { sendPush } from "./notifier.js";

export function toDeviceDTO(device: DeviceDoc, sims: SimInfo[] = []): DeviceDTO {
  return {
    deviceId: device.deviceId,
    name: device.name,
    platform: device.platform,
    role: device.role,
    publicKey: device.publicKey,
    signingPublicKey: device.signingPublicKey,
    signingKeyFingerprint: device.signingKeyFingerprint,
    protocolVersion: device.protocolVersion ?? 0,
    sims,
    status: device.status,
    lastSeenAt: device.lastSeenAt?.toISOString?.() ?? new Date(0).toISOString(),
    createdAt: device.createdAt?.toISOString?.() ?? new Date(0).toISOString(),
  };
}

export function toPairDTO(pair: PairDoc, extras?: Partial<PairDTO>): PairDTO {
  return {
    pairId: pair.pairId,
    status: pair.status,
    senderDeviceId: pair.senderDeviceId,
    receiverDeviceId: pair.receiverDeviceId,
    roomId: pair.roomId,
    code: pair.code,
    codeExpiresAt: pair.codeExpiresAt?.toISOString?.(),
    acceptedAt: pair.acceptedAt?.toISOString?.(),
    createdAt: pair.createdAt?.toISOString?.() ?? new Date(0).toISOString(),
    protocolVersion: 0,
    senderFingerprintConfirmed: !!pair.senderFingerprintConfirmed,
    receiverFingerprintConfirmed: !!pair.receiverFingerprintConfirmed,
    ...extras,
  };
}

/** Attach counterpart display names to a list of pairs. */
export async function decoratePairs(pairs: PairDoc[], myDeviceId: string): Promise<PairDTO[]> {
  const otherIds = [
    ...new Set(pairs.map((p) => (p.senderDeviceId === myDeviceId ? p.receiverDeviceId : p.senderDeviceId))),
  ];
  const others = otherIds.length
    ? await Device.find({ deviceId: { $in: otherIds } }).lean<DeviceDoc[]>()
    : [];
  const nameById = new Map(others.map((d) => [d.deviceId, d.name]));
  const keyById = new Map(others.map((d) => [d.deviceId, d.publicKey]));
  const me = await Device.findOne({ deviceId: myDeviceId }).lean<DeviceDoc>();
  if (me) keyById.set(me.deviceId, me.publicKey);
  return pairs.map((p) => {
    const sender = p.senderDeviceId === myDeviceId ? me : others.find((o) => o.deviceId === p.senderDeviceId);
    const receiver = p.receiverDeviceId === myDeviceId ? me : others.find((o) => o.deviceId === p.receiverDeviceId);
    // Effective protocol: V1 only when BOTH devices are hardened.
    const bothHardened =
      sender?.protocolVersion === 1 && receiver?.protocolVersion === 1;
    // The pin is authoritative; pre-migration pairs fall back to the sender's
    // currently-registered signing key so confirmation can happen lazily.
    const pinnedSignKey = p.pinnedSenderSignKey ?? sender?.signingPublicKey;
    const pinnedFingerprint =
      p.pinnedSenderSignKeyFingerprint ?? sender?.signingKeyFingerprint;
    return toPairDTO(p, {
      senderName:
        p.senderDeviceId === myDeviceId ? undefined : nameById.get(p.senderDeviceId),
      receiverName:
        p.receiverDeviceId === myDeviceId ? undefined : nameById.get(p.receiverDeviceId),
      senderPublicKey: keyById.get(p.senderDeviceId),
      receiverPublicKey: keyById.get(p.receiverDeviceId),
      senderSigningPublicKey: pinnedSignKey,
      senderSigningKeyFingerprint: pinnedFingerprint,
      receiverSigningPublicKey: receiver?.signingPublicKey,
      receiverSigningKeyFingerprint: receiver?.signingKeyFingerprint,
      protocolVersion: bothHardened && pinnedSignKey ? 1 : 0,
      senderFingerprintConfirmed: !!p.senderFingerprintConfirmed,
      receiverFingerprintConfirmed: !!p.receiverFingerprintConfirmed,
    });
  });
}

async function findReceiverDeviceId(input: {
  receiverDeviceId?: string;
  receiverPhoneNumber?: string;
}): Promise<DeviceDoc> {
  let receiver: DeviceDoc | null = null;
  if (input.receiverDeviceId) {
    receiver = await Device.findOne({ deviceId: input.receiverDeviceId, role: "receiver" }).lean<DeviceDoc>();
  } else if (input.receiverPhoneNumber) {
    const sim = await SimSubscription.findOne({
      phoneNumber: input.receiverPhoneNumber,
    }).lean<SimInfo & { deviceId: string }>();
    if (sim) {
      receiver = await Device.findOne({ deviceId: sim.deviceId, role: "receiver" }).lean<DeviceDoc>();
    }
  }
  if (!receiver) throw errors.notFound("No receiver device found for the given deviceId/phone number");
  return receiver;
}

/** Step 2-3 of the feature flow: role selection -> pairing request. */
export async function createPair(
  sender: { deviceId: string; role: Role; name: string },
  input: { receiverDeviceId?: string; receiverPhoneNumber?: string },
): Promise<CreatePairResult> {
  if (sender.role !== "sender") throw errors.forbidden("Only sender devices can create pairing requests");

  const receiver = await findReceiverDeviceId(input);
  if (receiver.deviceId === sender.deviceId) throw errors.validation("A device cannot pair with itself");

  const existing = await Pair.findOne({
    senderDeviceId: sender.deviceId,
    receiverDeviceId: receiver.deviceId,
    status: { $in: ["pending", "active"] },
  }).lean<PairDoc>();
  if (existing?.status === "active") throw errors.pairAlreadyActive();

  const code = newPairingCode();
  const codeExpiresAt = new Date(Date.now() + env.pairingCodeTtlMinutes * 60_000);

  let pair: PairDoc;
  if (existing) {
    // Refresh the code on an expired-but-uncleaned pending pair.
    const updated = await Pair.findOneAndUpdate(
      { pairId: existing.pairId, status: "pending" },
      { $set: { code, codeExpiresAt } },
      { new: true },
    ).lean<PairDoc>();
    pair = updated!;
  } else {
    pair = await Pair.create({
      pairId: newId("pair"),
      code,
      codeExpiresAt,
      senderDeviceId: sender.deviceId,
      receiverDeviceId: receiver.deviceId,
      status: "pending",
      seq: 0,
    }).then((doc) => doc.toObject() as PairDoc);
  }

  // Notify the receiver over Socket.IO + push (works even if it is offline via push relay).
  const receiverOnline = isDeviceOnline(receiver.deviceId);
  const io = tryGetIo();
  if (io) {
    io.to(deviceRoom(receiver.deviceId)).emit(SocketEvents.PAIRING_INCOMING, {
      pairId: pair.pairId,
      code,
      senderDeviceId: sender.deviceId,
      senderName: sender.name,
      expiresAt: codeExpiresAt.toISOString(),
    });
  }
  void sendPush({
    deviceId: receiver.deviceId,
    title: "SIMBridge pairing request",
    body: `${sender.name} wants to relay SMS to this device. Code: ${code}`,
    data: { pairId: pair.pairId, code },
  });

  audit("pair.created", { deviceId: sender.deviceId, pairId: pair.pairId });
  return {
    ...toPairDTO(pair),
    receiverOnline,
  };
}

/** Receiver accepts a pairing request with the 6-digit code. */
export async function acceptPair(
  receiver: { deviceId: string; role: Role; name: string },
  code: string,
): Promise<AcceptPairResult> {
  if (receiver.role !== "receiver") throw errors.forbidden("Only receiver devices can accept pairing requests");

  const pair = await Pair.findOne({ code, status: "pending" }).lean<PairDoc>();
  if (!pair) throw errors.pairCodeExpired();
  if (!pair.codeExpiresAt || pair.codeExpiresAt.getTime() < Date.now()) {
    await Pair.deleteOne({ pairId: pair.pairId });
    throw errors.pairCodeExpired();
  }
  if (pair.receiverDeviceId !== receiver.deviceId) {
    throw errors.forbidden("This pairing code was generated for a different receiver device");
  }

  const roomId = newId("room");
  const cleaned = await Pair.findOneAndUpdate(
    { pairId: pair.pairId, status: "pending" },
    { $set: { status: "active", roomId, acceptedAt: new Date() }, $unset: { code: 1, codeExpiresAt: 1 } },
    { new: true },
  ).lean<PairDoc>();
  if (!cleaned) throw errors.pairCodeExpired();

  // Pin the sender's current signing identity. The receiver verifies every V1
  // envelope against this pin; a sender key rotation clears the receiver's
  // confirmation so it must re-verify before V1 resumes.
  const sender = await Device.findOne({ deviceId: cleaned.senderDeviceId }).lean<DeviceDoc>();
  if (sender?.signingPublicKey) {
    await Pair.updateOne(
      { pairId: cleaned.pairId },
      {
        $set: {
          pinnedSenderSignKey: sender.signingPublicKey,
          pinnedSenderSignKeyFingerprint: sender.signingKeyFingerprint,
        },
      },
    );
  }

// Put every connected socket of both devices into the pair room.
  const io = tryGetIo();
  if (io) {
    io.in(deviceRoom(cleaned.senderDeviceId)).socketsJoin(pairRoom(roomId));
    io.in(deviceRoom(receiver.deviceId)).socketsJoin(pairRoom(roomId));
    io.to(deviceRoom(cleaned.senderDeviceId)).emit(SocketEvents.PAIRING_ACCEPTED, {
      pairId: cleaned.pairId,
      roomId,
      receiverDeviceId: receiver.deviceId,
      receiverName: receiver.name,
    });
  }

  audit("pair.accepted", { deviceId: receiver.deviceId, pairId: cleaned.pairId });
  return {
    pairId: cleaned.pairId,
    roomId,
    senderDeviceId: cleaned.senderDeviceId,
    senderName: sender?.name ?? "Sender",
    senderPublicKey: sender?.publicKey ?? "",
    senderSigningPublicKey: sender?.signingPublicKey,
  };
}

/**
 * Record that the calling device has verified the OTHER device's fingerprint.
 * The confirmation always applies to the pair's current identity snapshot, so a
 * sender that rotated keys after the pin only re-satisfies V1 once the receiver
 * deliberately re-confirms the NEW fingerprint.
 */
export async function confirmPairFingerprint(
  device: { deviceId: string; role: Role },
  pairId: string,
): Promise<PairDTO> {
  const pair = await Pair.findOne({ pairId }).lean<PairDoc>();
  if (!pair) throw errors.pairNotFound();
  if (pair.status !== "active") throw errors.forbidden("Pair is not active");
  if (pair.senderDeviceId !== device.deviceId && pair.receiverDeviceId !== device.deviceId) {
    throw errors.forbidden("You are not a participant of this pair");
  }

  const isSender = pair.senderDeviceId === device.deviceId;
  const field = isSender ? "senderFingerprintConfirmed" : "receiverFingerprintConfirmed";

  // Sending a signed envelope requires a pinned sender key; confirmations on a
  // pair without one are impossible to satisfy meaningfully.
  if (device.role === "receiver") {
    const sender = await Device.findOne({ deviceId: pair.senderDeviceId }).lean<DeviceDoc>();
    if (!sender?.signingPublicKey) {
      throw errors.validation("The sender of this pair is not V1-capable yet — no key to verify");
    }
  }

  await Pair.updateOne(
    { pairId: pair.pairId, status: "active" },
    { $set: { [field]: true } },
  );

  audit("pair.fingerprint.confirmed", { deviceId: device.deviceId, pairId });
  const doc = await Pair.findOne({ pairId: pair.pairId }).lean<PairDoc>();
  if (!doc) throw errors.pairNotFound();
  const [updated] = await decoratePairs([doc], device.deviceId);
  return updated;
}

export async function revokePair(device: { deviceId: string }, pairId: string): Promise<void> {
  const pair = await Pair.findOne({ pairId }).lean<PairDoc>();
  if (!pair) throw errors.pairNotFound();
  if (pair.senderDeviceId !== device.deviceId && pair.receiverDeviceId !== device.deviceId) {
    throw errors.forbidden("You are not a participant of this pair");
  }
  await Pair.updateOne(
    { pairId },
    { $set: { status: "revoked", revokedAt: new Date() } },
  );
  const io = tryGetIo();
  if (io && pair.roomId) {
    io.in(pairRoom(pair.roomId)).socketsLeave(pairRoom(pair.roomId));
  }
  if (io) {
    io.to(deviceRoom(pair.senderDeviceId))
      .to(deviceRoom(pair.receiverDeviceId))
      .emit(SocketEvents.PAIR_REVOKED, { pairId, roomId: pair.roomId });
  }
  audit("pair.revoked", { deviceId: device.deviceId, pairId });
}

export async function listPairs(deviceId: string): Promise<PairDTO[]> {
  const pairs = await Pair.find({
    $or: [{ senderDeviceId: deviceId }, { receiverDeviceId: deviceId }],
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean<PairDoc[]>();
  return decoratePairs(pairs, deviceId);
}
