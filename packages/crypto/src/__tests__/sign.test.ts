import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import { signEnvelopeV1, verifyEnvelopeV1 } from "../sign";
import { bytesToBase64 } from "../base64";
import {
  GOLDEN_ENVELOPE,
  GOLDEN_SIGNATURE,
  GOLDEN_SIGN_PUBLIC_KEY,
  GOLDEN_SIGN_SECRET_KEY,
} from "../golden";

/** A second, valid-but-wrong Ed25519 keypair (deterministic seed). */
function makeWrongKey(): string {
  const seed = new Uint8Array(nacl.sign.seedLength);
  for (let i = 0; i < seed.length; i++) seed[i] = 0x42;
  return bytesToBase64(nacl.sign.keyPair.fromSeed(seed).publicKey);
}

describe("signEnvelopeV1 / verifyEnvelopeV1", () => {
  it("signs the golden envelope to the locked signature", () => {
    expect(signEnvelopeV1(GOLDEN_ENVELOPE, GOLDEN_SIGN_SECRET_KEY)).toBe(GOLDEN_SIGNATURE);
  });

  it("verifies a valid signature", () => {
    expect(verifyEnvelopeV1(GOLDEN_ENVELOPE, GOLDEN_SIGN_PUBLIC_KEY, GOLDEN_SIGNATURE)).toBe(true);
  });

  it.each(["messageId", "pairId", "senderDeviceId", "receiverDeviceId", "senderSignKeyFingerprint", "ephemPublicKey", "nonce", "ciphertext", "createdAt", "scheme", "version"] as const)(
    "fails verification when '%s' is tampered with",
    (field) => {
      const tampered = { ...GOLDEN_ENVELOPE, [field]: `${GOLDEN_ENVELOPE[field]}X` };
      expect(
        verifyEnvelopeV1(tampered as never, GOLDEN_SIGN_PUBLIC_KEY, GOLDEN_SIGNATURE),
      ).toBe(false);
    },
  );

  it("fails verification with the wrong signer public key", () => {
    expect(verifyEnvelopeV1(GOLDEN_ENVELOPE, makeWrongKey(), GOLDEN_SIGNATURE)).toBe(false);
  });

  it("fails verification on an arbitrary (non-signature) string", () => {
    expect(verifyEnvelopeV1(GOLDEN_ENVELOPE, GOLDEN_SIGN_PUBLIC_KEY, "AAAA")).toBe(false);
  });

  it("fails verification when the public key is malformed", () => {
    expect(verifyEnvelopeV1(GOLDEN_ENVELOPE, "not-base64!", GOLDEN_SIGNATURE)).toBe(false);
  });

  it("sign+verify round-trips with a fresh envelope", () => {
    const env = { ...GOLDEN_ENVELOPE, messageId: "msg_roundtrip-0000-0000-0000-000000000000" };
    const sig = signEnvelopeV1(env, GOLDEN_SIGN_SECRET_KEY);
    expect(sig).not.toBe(GOLDEN_SIGNATURE); // different signed fields -> different signature
    expect(verifyEnvelopeV1(env, GOLDEN_SIGN_PUBLIC_KEY, sig)).toBe(true);
  });
});