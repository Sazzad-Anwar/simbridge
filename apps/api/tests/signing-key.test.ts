import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import {
  fingerprintOf,
  generateSigningKeyPair,
  proveKeyPossession,
} from "@simbridge/crypto";
import { hasMongo } from "./setup.js";
import {
  api,
  base64ToBytes,
  freshIdentity,
  registerDevice,
  rekeyDevice,
} from "./helpers.js";

describe.skipIf(!hasMongo)("PATCH /me — signing-key add/rotation (re-key)", () => {
  let legacyToken = "";
  let legacyEncPublicKey = "";

  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
    const legacy = freshIdentity();
    const res = await registerDevice(`+15560000001`, legacy, { hardened: false });
    expect(res.status).toBe(201);
    legacyToken = res.body.data.accessToken;
    legacyEncPublicKey = legacy.encPublicKey;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
  });

  it("requires authentication to issue a re-key challenge", async () => {
    const res = await api("/auth/challenge/rekey", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects a signing-key update without the challenge fields", async () => {
    const res = await api("/me", {
      method: "PATCH",
      token: legacyToken,
      body: { signingPublicKey: freshIdentity().signPublicKey },
    });
    expect(res.status).toBe(422);
  });

  it("lets a legacy device adopt a signing key (self-attestation) → protocolVersion 1", async () => {
    const newSign = generateSigningKeyPair();
    const issue = await api("/auth/challenge/rekey", { method: "POST", token: legacyToken });
    const challengePoP = proveKeyPossession(
      newSign.signSecretKey,
      base64ToBytes(issue.body.data.challenge),
    );

    const res = await api("/me", {
      method: "PATCH",
      token: legacyToken,
      body: {
        signingPublicKey: newSign.signPublicKey,
        signingKeyFingerprint: fingerprintOf(legacyEncPublicKey, newSign.signPublicKey),
        challengeId: issue.body.data.challengeId,
        challengePoP,
      },
    });
    expect(res.status).toBe(200);

    const me = await api("/me", { token: legacyToken });
    expect(me.body.data.protocolVersion).toBe(1);
    expect(me.body.data.signingPublicKey).toBe(newSign.signPublicKey);
  });

  it("rotates an existing signing key only when possession of the CURRENT key is proven", async () => {
    const existing = freshIdentity();
    const reg = await registerDevice(`+15560000002`, existing, { hardened: true });
    expect(reg.status).toBe(201);
    const token = reg.body.data.accessToken;

    // Correct rotation: sign with the CURRENT registered key.
    const rotated = generateSigningKeyPair();
    const good = await rekeyDevice(
      token,
      existing.encPublicKey,
      { signSecretKey: existing.signSecretKey, signPublicKey: existing.signPublicKey },
      rotated,
    );
    expect(good.status).toBe(200);

    const me1 = await api("/me", { token });
    expect(me1.body.data.signingPublicKey).toBe(rotated.signPublicKey);

    // Attacker holds no current key but tries to swap in their own: rejected.
    const attacker = generateSigningKeyPair();
    const bad = await rekeyDevice(
      token,
      existing.encPublicKey,
      { signSecretKey: attacker.signSecretKey, signPublicKey: attacker.signPublicKey },
      attacker,
    );
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe("INVALID_SIGNATURE");

    const me2 = await api("/me", { token });
    expect(me2.body.data.signingPublicKey).toBe(rotated.signPublicKey);
  });

  it("binds re-key challenges to the issuing device", async () => {
    const deviceA = freshIdentity();
    const deviceB = freshIdentity();
    const regA = await registerDevice(`+15560000003`, deviceA, { hardened: true });
    const regB = await registerDevice(`+15560000004`, deviceB, { hardened: true });
    const tokenA = regA.body.data.accessToken;
    const tokenB = regB.body.data.accessToken;

    const issueA = await api("/auth/challenge/rekey", { method: "POST", token: tokenA });
    const challengePoP = proveKeyPossession(
      deviceA.signSecretKey,
      base64ToBytes(issueA.body.data.challenge),
    );

    // Device B tries to use A's challenge — must fail (device-bound).
    const resB = await api("/me", {
      method: "PATCH",
      token: tokenB,
      body: {
        signingPublicKey: deviceB.signPublicKey,
        signingKeyFingerprint: deviceB.fingerprint,
        challengeId: issueA.body.data.challengeId,
        challengePoP,
      },
    });
    expect(resB.status).toBe(403);
  });

  it("idempotently re-asserts the same key without errors", async () => {
    const existing = freshIdentity();
    const reg = await registerDevice(`+15560000005`, existing, { hardened: true });
    const token = reg.body.data.accessToken;
    const res = await rekeyDevice(
      token,
      existing.encPublicKey,
      { signSecretKey: existing.signSecretKey, signPublicKey: existing.signPublicKey },
      { signPublicKey: existing.signPublicKey },
    );
    expect(res.status).toBe(200);
  });
});