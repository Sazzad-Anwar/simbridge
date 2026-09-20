import { describe, it, expect } from "vitest";
import {
  canonicalizeV1,
  CANONICAL_MAGIC,
  CANONICAL_FIELD_KEYS,
} from "../canonicalize";
import { signEnvelopeV1, verifyEnvelopeV1 } from "../sign";
import {
  GOLDEN_CANONICAL_HEX,
  GOLDEN_ENVELOPE,
  GOLDEN_SIGNATURE,
  GOLDEN_SIGN_SECRET_KEY,
  GOLDEN_SIGN_PUBLIC_KEY,
} from "../golden";
import { CRYPTO_SCHEME, CRYPTO_PROTOCOL_VERSION } from "../protocol";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("golden vectors (locked)", () => {
  it("canonicalization matches the locked digest", () => {
    expect(toHex(canonicalizeV1(GOLDEN_ENVELOPE))).toBe(GOLDEN_CANONICAL_HEX);
  });

  it("signature matches the locked value and verifies", () => {
    expect(signEnvelopeV1(GOLDEN_ENVELOPE, GOLDEN_SIGN_SECRET_KEY)).toBe(GOLDEN_SIGNATURE);
    expect(verifyEnvelopeV1(GOLDEN_ENVELOPE, GOLDEN_SIGN_PUBLIC_KEY, GOLDEN_SIGNATURE)).toBe(true);
  });

  it("signed fields match the required schema order", () => {
    expect(CANONICAL_FIELD_KEYS).toEqual([
      "version",
      "scheme",
      "messageId",
      "pairId",
      "senderDeviceId",
      "receiverDeviceId",
      "senderSignKeyFingerprint",
      "ephemPublicKey",
      "nonce",
      "ciphertext",
      "createdAt",
    ]);
  });

  it("signature covers senderSignKeyFingerprint (changing it breaks verification)", () => {
    const changed = { ...GOLDEN_ENVELOPE, senderSignKeyFingerprint: "FINGERPRINT-CHANGED" };
    expect(verifyEnvelopeV1(changed, GOLDEN_SIGN_PUBLIC_KEY, GOLDEN_SIGNATURE)).toBe(false);
  });

  it("golden envelope uses the current scheme/version", () => {
    expect(GOLDEN_ENVELOPE.version).toBe(CRYPTO_PROTOCOL_VERSION);
    expect(GOLDEN_ENVELOPE.scheme).toBe(CRYPTO_SCHEME);
  });

  it("magic prefix is stable", () => {
    expect(CANONICAL_MAGIC).toBe("SIMBRIDGE/ENVELOPE/V1\0");
  });
});