import { describe, it, expect } from "vitest";
import { generateDeviceIdentity, generateSigningKeyPair, fingerprintOf } from "../identity";
import { publicKeyFromSecret } from "../index";
import { GOLDEN_ENC_PUBLIC_KEY, GOLDEN_SIGN_PUBLIC_KEY, GOLDEN_FINGERPRINT } from "../golden";

describe("generateDeviceIdentity", () => {
  it("generates a full identity with enc + sign keys", () => {
    const id = generateDeviceIdentity();
    expect(id.encPublicKey.length).toBeGreaterThan(0);
    expect(id.encSecretKey.length).toBeGreaterThan(0);
    expect(id.signPublicKey.length).toBeGreaterThan(0);
    expect(id.signSecretKey.length).toBeGreaterThan(0);
    expect(id.fingerprint.length).toBeGreaterThan(0);
  });

  it("derives the encryption public key from the encryption secret key", () => {
    const id = generateDeviceIdentity();
    expect(publicKeyFromSecret(id.encSecretKey)).toBe(id.encPublicKey);
  });

  it("generates distinct identities per call", () => {
    const a = generateDeviceIdentity();
    const b = generateDeviceIdentity();
    expect(a.encSecretKey).not.toBe(b.encSecretKey);
    expect(a.signSecretKey).not.toBe(b.signSecretKey);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("fingerprint is deterministic for the same key pair", () => {
    const id = generateDeviceIdentity();
    expect(fingerprintOf(id.encPublicKey, id.signPublicKey)).toBe(id.fingerprint);
  });

  it("fingerprint differs when one public key changes", () => {
    const id = generateDeviceIdentity();
    const other = generateDeviceIdentity();
    expect(fingerprintOf(id.encPublicKey, other.signPublicKey)).not.toBe(id.fingerprint);
  });

  it("reproduces the locked golden fingerprint for the golden keys", () => {
    expect(fingerprintOf(GOLDEN_ENC_PUBLIC_KEY, GOLDEN_SIGN_PUBLIC_KEY)).toBe(GOLDEN_FINGERPRINT);
  });

  it("generateSigningKeyPair produces a standalone signing pair (migration path)", () => {
    const enc = generateDeviceIdentity();
    const sign = generateSigningKeyPair();
    expect(sign.signPublicKey.length).toBeGreaterThan(0);
    expect(sign.signSecretKey.length).toBeGreaterThan(0);
    expect(enc.encSecretKey).not.toContain(sign.signSecretKey); // enc keys preserved as-is
    expect(sign.signPublicKey).not.toBe(enc.signPublicKey);
    // fingerprint can be derived from pre-existing enc + freshly-generated sign
    const fp = fingerprintOf(enc.encPublicKey, sign.signPublicKey);
    expect(fp.length).toBeGreaterThan(0);
    expect(fp).not.toBe(enc.fingerprint);
  });
});