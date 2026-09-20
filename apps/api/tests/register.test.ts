import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { hasMongo } from "./setup.js";
import {
  api,
  freshIdentity,
  issueRegisterChallenge,
  registerDevice,
  signChallenge,
} from "./helpers.js";

describe.skipIf(!hasMongo)("POST /auth/register — Proof of Possession gating", () => {
  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
  });

  it("legacy registration without a signing key still works (returns apiKey + token)", async () => {
    const id = freshIdentity();
    const res = await registerDevice(`+15550000001`, id, { hardened: false });
    expect(res.status).toBe(201);
    expect(res.body.data.deviceId).toBeTruthy();
    expect(res.body.data.apiKey).toBeTruthy();
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it("rejects a signing key without a proof-of-possession challenge", async () => {
    const id = freshIdentity();
    const res = await api("/auth/register", {
      method: "POST",
      body: {
        name: `+15550000002`,
        role: "sender",
        platform: "android",
        publicKey: id.encPublicKey,
        signingPublicKey: id.signPublicKey,
        signingKeyFingerprint: id.fingerprint,
      },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("KEY_POP_REQUIRED");
  });

  it("accepts a signing key when possession is proven against a real challenge", async () => {
    const id = freshIdentity();
    const res = await registerDevice(`+15550000003`, id, { hardened: true });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("sender");
  });

  it("rejects a challenge signed with the WRONG secret key", async () => {
    const id = freshIdentity();
    const other = freshIdentity();
    const { challengeId, challenge } = await issueRegisterChallenge();
    const res = await registerDevice(`+15550000004`, id, {
      hardened: true,
      challengeId,
      challengePoP: signChallenge(other.signSecretKey, challenge),
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_SIGNATURE");
  });

  it("challenges are single-use (reuse is rejected)", async () => {
    const first = freshIdentity();
    const { challengeId, challenge } = await issueRegisterChallenge();
    const firstRes = await registerDevice(`+15550000005`, first, {
      hardened: true,
      challengeId,
      challengePoP: signChallenge(first.signSecretKey, challenge),
    });
    expect(firstRes.status).toBe(201);

    const second = freshIdentity();
    const secondRes = await registerDevice(`+15550000006`, second, {
      hardened: true,
      challengeId,
      challengePoP: signChallenge(second.signSecretKey, challenge),
    });
    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error.code).toBe("CHALLENGE_REUSED");
  });

  it("rejects an expired challenge", async () => {
    const id = freshIdentity();
    const { challengeId } = await issueRegisterChallenge();
    await mongoose.connection.collection("challenges").updateOne(
      { challengeId },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } },
    );
    const challengePoP = "x".repeat(128);
    const res = await api("/auth/register", {
      method: "POST",
      body: {
        name: `+15550000007`,
        role: "sender",
        platform: "android",
        publicKey: id.encPublicKey,
        signingPublicKey: id.signPublicKey,
        signingKeyFingerprint: id.fingerprint,
        challengeId,
        challengePoP,
      },
    });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("CHALLENGE_EXPIRED");
  });

  it("rejects a fingerprint that does not match the supplied keys", async () => {
    const id = freshIdentity();
    const { challengeId, challenge } = await issueRegisterChallenge();
    const res = await registerDevice(`+15550000008`, id, {
      hardened: true,
      challengeId,
      challengePoP: signChallenge(id.signSecretKey, challenge),
      signingKeyFingerprint: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    });
    expect(res.status).toBe(422);
  });

  it("same-identity re-registration is a reclaim (200) and rotates the apiKey", async () => {
    const id = freshIdentity();
    const first = await registerDevice(`+15550000009`, id, { hardened: true });
    expect(first.status).toBe(201);
    const firstKey = first.body.data.apiKey;

    const second = await registerDevice(`+15550000009`, id, { hardened: true });
    expect(second.status).toBe(200);
    expect(second.body.data.apiKey).not.toBe(firstKey);
    expect(second.body.data.deviceId).toBe(first.body.data.deviceId);
  });

  it("rejects silently replacing a HARDENED identity (no number takeover)", async () => {
    const original = freshIdentity();
    const first = await registerDevice(`+15550000010`, original, { hardened: true });
    expect(first.status).toBe(201);

    const attacker = freshIdentity();
    const res = await registerDevice(`+15550000010`, attacker, { hardened: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DEVICE_KEY_CHANGED");
  });

  it("allows a legacy device to adopt a fresh keypair with PoP (migration reclaim)", async () => {
    const legacy = freshIdentity();
    const first = await registerDevice(`+15550000011`, legacy, { hardened: false });
    expect(first.status).toBe(201);

    // Reinstall with a brand-new encryption + sign key pair, proven with PoP.
    const reinstalled = freshIdentity();
    const res = await registerDevice(`+15550000011`, reinstalled, { hardened: true });
    expect(res.status).toBe(200);
    expect(res.body.data.deviceId).toBe(first.body.data.deviceId);

    const me = await api("/me", { token: res.body.data.accessToken });
    expect(me.body.data.protocolVersion).toBe(1);
    expect(me.body.data.signingPublicKey).toBe(reinstalled.signPublicKey);
  });

  it("legacy re-registration with same keys stays legacy (protocolVersion 0)", async () => {
    const id = freshIdentity();
    const first = await registerDevice(`+15550000012`, id, { hardened: false });
    expect(first.status).toBe(201);
    const second = await registerDevice(`+15550000012`, id, { hardened: false });
    expect(second.status).toBe(200);
    const me = await api("/me", { token: second.body.data.accessToken });
    expect(me.body.data.protocolVersion).toBe(0);
    expect(me.body.data.signingPublicKey).toBeUndefined();
  });
});