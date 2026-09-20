import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import {
  decryptEnvelopeV1,
  encryptMessageV1,
  encrypt,
  fingerprintOf,
  generateSigningKeyPair,
} from "@simbridge/crypto";
import { hasMongo } from "./setup.js";
import {
  api,
  freshIdentity,
  registerDevice,
  rekeyDevice,
  type TestIdentity,
} from "./helpers.js";

describe.skipIf(!hasMongo)("V1 signed envelopes — relay, verify, confirm", () => {
  let sender: TestIdentity;
  let receiver: TestIdentity;
  let senderDeviceId = "";
  let receiverDeviceId = "";
  let senderToken = "";
  let receiverToken = "";
  let pairId = "";

  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
  });

  async function setupPair() {
    sender = freshIdentity();
    receiver = freshIdentity();
    const regS = await registerDevice(`+15570000001`, sender, { role: "sender" });
    const regR = await registerDevice(`+15570000002`, receiver, { role: "receiver" });
    expect(regS.status).toBe(201);
    expect(regR.status).toBe(201);
    senderDeviceId = regS.body.data.deviceId;
    receiverDeviceId = regR.body.data.deviceId;
    senderToken = regS.body.data.accessToken;
    receiverToken = regR.body.data.accessToken;

    const created = await api("/pairs", {
      method: "POST",
      token: senderToken,
      body: { receiverDeviceId },
    });
    expect(created.status).toBe(201);
    const code = created.body.data.code;

    const accepted = await api(`/pairs/accept/${code}`, { method: "POST", token: receiverToken });
    expect(accepted.status).toBe(200);
    pairId = accepted.body.data.pairId;
  }

  it("exposes V1 keys + pin on the pair before either side confirms", async () => {
    await setupPair();
    const list = await api("/pairs", { token: senderToken });
    expect(list.status).toBe(200);
    const pair = list.body.data.find((p: { pairId: string }) => p.pairId === pairId);
    expect(pair.protocolVersion).toBe(1);
    expect(pair.senderSigningPublicKey).toBe(sender.signPublicKey);
    expect(pair.senderSigningKeyFingerprint).toBe(sender.fingerprint);
    expect(pair.receiverSigningKeyFingerprint).toBe(receiver.fingerprint);
    expect(pair.senderFingerprintConfirmed).toBe(false);
    expect(pair.receiverFingerprintConfirmed).toBe(false);
  });

  it("verifies a V1 envelope server-side and relays it (receiver decrypts)", async () => {
    const env = encryptMessageV1({
      messageId: `envt_${Date.now()}`,
      pairId,
      senderDeviceId: senderDeviceId,
      receiverDeviceId: receiverDeviceId,
      senderSignKeyFingerprint: sender.fingerprint,
      receiverEncPublicKey: receiver.encPublicKey,
      senderSignSecretKey: sender.signSecretKey,
      plaintext: "e2e: signed OTP 663211",
    });

    const sent = await api("/messages", {
      method: "POST",
      token: senderToken,
      body: {
        pairId,
        clientMsgId: "v1-" + Date.now(),
        payload: env,
      },
    });
    expect(sent.status).toBe(200);
    expect(sent.body.data.deduplicated).toBe(false);

    const sync = await api(`/messages/sync?pairId=${pairId}&afterSeq=0`, { token: receiverToken });
    expect(sync.status).toBe(200);
    const msg = sync.body.data.messages.find((m: { seq: number }) => m.seq === 1);
    expect(msg.payload.version).toBe(1);
    expect(msg.payload.signature).toBeTruthy();

    const plain = decryptEnvelopeV1({
      envelope: msg.payload,
      receiverEncSecretKey: receiver.encSecretKey,
      senderSignPublicKey: sender.signPublicKey,
      expectedSenderSignKeyFingerprint: sender.fingerprint,
    });
    expect(plain).toBe("e2e: signed OTP 663211");
  });

  it("records per-side fingerprint confirmations", async () => {
    const receiverConfirm = await api(`/pairs/${pairId}/confirm`, {
      method: "POST",
      token: receiverToken,
    });
    expect(receiverConfirm.status).toBe(200);
    expect(receiverConfirm.body.data.receiverFingerprintConfirmed).toBe(true);

    const senderConfirm = await api(`/pairs/${pairId}/confirm`, {
      method: "POST",
      token: senderToken,
    });
    expect(senderConfirm.status).toBe(200);
    expect(senderConfirm.body.data.senderFingerprintConfirmed).toBe(true);

    const asReceiver = await api("/pairs", { token: receiverToken });
    const pair = asReceiver.body.data.find((p: { pairId: string }) => p.pairId === pairId);
    expect(pair.receiverFingerprintConfirmed).toBe(true);
  });

  it("rejects an envelope claiming a different sender device than the authenticated one", async () => {
    const thirdParty = freshIdentity();
    const register = await registerDevice(`+15570000003`, thirdParty, { role: "sender" });
    expect(register.status).toBe(201);

    // Authenticated as the REAL pair sender, but the envelope advertises a
    // different device's id as its author.
    const env = encryptMessageV1({
      messageId: `envt_${Date.now()}`,
      pairId,
      senderDeviceId: register.body.data.deviceId, // NOT the authenticated sender
      receiverDeviceId: receiverDeviceId,
      senderSignKeyFingerprint: thirdParty.fingerprint,
      receiverEncPublicKey: receiver.encPublicKey,
      senderSignSecretKey: thirdParty.signSecretKey,
      plaintext: "impostor",
    });
    const res = await api("/messages", {
      method: "POST",
      token: senderToken,
      body: { pairId, clientMsgId: "v1-impostor", payload: env },
    });
    expect(res.status).toBe(403);
  });

  it("rejects a tampered signature (INVALID_SIGNATURE)", async () => {
    const env = encryptMessageV1({
      messageId: `envt_${Date.now()}`,
      pairId,
      senderDeviceId: senderDeviceId,
      receiverDeviceId: receiverDeviceId,
      senderSignKeyFingerprint: sender.fingerprint,
      receiverEncPublicKey: receiver.encPublicKey,
      senderSignSecretKey: sender.signSecretKey,
      plaintext: "tamper me",
    });
    const tampered = { ...env, ciphertext: env.ciphertext.replace(/.$/, "0"), signature: env.signature };
    const res = await api("/messages", {
      method: "POST",
      token: senderToken,
      body: { pairId, clientMsgId: "v1-tampered", payload: tampered },
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_SIGNATURE");
  });

  it("rejects an envelope bound to a different receiver device", async () => {
    const other = freshIdentity();
    const regOther = await registerDevice(`+15570000004`, other, { role: "receiver" });

    const env = encryptMessageV1({
      messageId: `envt_${Date.now()}`,
      pairId,
      senderDeviceId: senderDeviceId,
      receiverDeviceId: regOther.body.data.deviceId, // different receiver
      senderSignKeyFingerprint: sender.fingerprint,
      receiverEncPublicKey: receiver.encPublicKey,
      senderSignSecretKey: sender.signSecretKey,
      plaintext: "wrong receiver",
    });
    const res = await api("/messages", {
      method: "POST",
      token: senderToken,
      body: { pairId, clientMsgId: "v1-wrongrecv", payload: env },
    });
    expect(res.status).toBe(422);
  });

  it("deduplicates a replayed signed envelope regardless of clientMsgId", async () => {
    const env = encryptMessageV1({
      messageId: `envt_${Date.now()}`,
      pairId,
      senderDeviceId: senderDeviceId,
      receiverDeviceId: receiverDeviceId,
      senderSignKeyFingerprint: sender.fingerprint,
      receiverEncPublicKey: receiver.encPublicKey,
      senderSignSecretKey: sender.signSecretKey,
      plaintext: "replay me",
    });

    const first = await api("/messages", {
      method: "POST",
      token: senderToken,
      body: { pairId, clientMsgId: "v1-replay-a", payload: env },
    });
    expect(first.status).toBe(200);
    expect(first.body.data.deduplicated).toBe(false);

    const replay = await api("/messages", {
      method: "POST",
      token: senderToken,
      body: { pairId, clientMsgId: "v1-replay-b", payload: env },
    });
    expect(replay.status).toBe(200);
    expect(replay.body.data.deduplicated).toBe(true);
    expect(replay.body.data.seq).toBe(first.body.data.seq);
  });

  it("stops an unhardened sender from submitting V1 envelopes", async () => {
    const legacySender = freshIdentity();
    const reg = await registerDevice(`+15570000005`, legacySender, { role: "sender", hardened: false });
    expect(reg.status).toBe(201);

    // The unhardened device IS this pair's sender, so the rejection must come
    // from the V1 verification path (no registered signing key), not from the
    // "only the sender may send" guard.
    const pairCreated = await api("/pairs", {
      method: "POST",
      token: reg.body.data.accessToken,
      body: { receiverDeviceId },
    });
    expect(pairCreated.status).toBe(201);
    const pairAccepted = await api(`/pairs/accept/${pairCreated.body.data.code}`, {
      method: "POST",
      token: receiverToken,
    });
    expect(pairAccepted.status).toBe(200);
    const legacyPairId = pairAccepted.body.data.pairId;

    const env = encryptMessageV1({
      messageId: `envt_${Date.now()}`,
      pairId: legacyPairId,
      senderDeviceId: reg.body.data.deviceId,
      receiverDeviceId,
      senderSignKeyFingerprint: legacySender.fingerprint,
      receiverEncPublicKey: receiver.encPublicKey,
      senderSignSecretKey: legacySender.signSecretKey,
      plaintext: "not allowed",
    });
    const res = await api("/messages", {
      method: "POST",
      token: reg.body.data.accessToken,
      body: { pairId: legacyPairId, clientMsgId: "v1-unhardened", payload: env },
    });
    expect(res.status).toBe(422);
  });

  it("clears the receiver confirmation + re-pins when the sender rotates its key", async () => {
    const rotated = generateSigningKeyPair();
    const rekeyed = await rekeyDevice(
      senderToken,
      sender.encPublicKey,
      { signSecretKey: sender.signSecretKey, signPublicKey: sender.signPublicKey },
      rotated,
    );
    expect(rekeyed.status).toBe(200);

    // Eager re-pin: the pair is coherent IMMEDIATELY after rotation — the
    // receiver sees the new fingerprint (matching the live key) and its
    // confirmation is already cleared, before any post-rotation message sends.
    const preList = await api("/pairs", { token: receiverToken });
    const prePair = preList.body.data.find((p: { pairId: string }) => p.pairId === pairId);
    expect(prePair.senderSigningPublicKey).toBe(rotated.signPublicKey);
    expect(prePair.senderSigningKeyFingerprint).toBe(fingerprintOf(sender.encPublicKey, rotated.signPublicKey));
    expect(prePair.receiverFingerprintConfirmed).toBe(false);

    // A send with the NEW key succeeds and keeps the re-pin stable.
    const env = encryptMessageV1({
      messageId: `envt_${Date.now()}`,
      pairId,
      senderDeviceId: senderDeviceId,
      receiverDeviceId: receiverDeviceId,
      senderSignKeyFingerprint: fingerprintOf(sender.encPublicKey, rotated.signPublicKey),
      receiverEncPublicKey: receiver.encPublicKey,
      senderSignSecretKey: rotated.signSecretKey,
      plaintext: "post rotation",
    });
    const sent = await api("/messages", {
      method: "POST",
      token: senderToken,
      body: { pairId, clientMsgId: "v1-rotation-" + Date.now(), payload: env },
    });
    expect(sent.status).toBe(200);

    const list = await api("/pairs", { token: receiverToken });
    const pair = list.body.data.find((p: { pairId: string }) => p.pairId === pairId);
    expect(pair.receiverFingerprintConfirmed).toBe(false);
    expect(pair.senderSigningKeyFingerprint).toBe(fingerprintOf(sender.encPublicKey, rotated.signPublicKey));
  });

  it("rejects envelopes signed by the pre-rotation key (server verifies against the current key)", async () => {
    const env = encryptMessageV1({
      messageId: `envt_${Date.now()}`,
      pairId,
      senderDeviceId: senderDeviceId,
      receiverDeviceId: receiverDeviceId,
      senderSignKeyFingerprint: sender.fingerprint,
      receiverEncPublicKey: receiver.encPublicKey,
      senderSignSecretKey: sender.signSecretKey, // pre-rotation key
      plaintext: "stale identity",
    });
    const res = await api("/messages", {
      method: "POST",
      token: senderToken,
      body: { pairId, clientMsgId: "v1-stale-" + Date.now(), payload: env },
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_SIGNATURE");
  });

  it("still accepts legacy V0 payloads (migration path)", async () => {
    const payload = encrypt(receiver.encPublicKey, "legacy v0 still fine");

    const res = await api("/messages", {
      method: "POST",
      token: senderToken,
      body: { pairId, clientMsgId: "v0-legacy-" + Date.now(), payload },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.deduplicated).toBe(false);
  });

  it("forbids confirmations from non-participants", async () => {
    const outsider = freshIdentity();
    const reg = await registerDevice(`+15570000006`, outsider, { role: "receiver" });
    const res = await api(`/pairs/${pairId}/confirm`, {
      method: "POST",
      token: reg.body.data.accessToken,
    });
    expect(res.status).toBe(403);
  });
});