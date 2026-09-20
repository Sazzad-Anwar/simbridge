import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import { proveKeyPossession, verifyKeyPossession, isValidSigningPublicKey } from "../pop";
import { bytesToBase64 } from "../base64";
import { GOLDEN_SIGN_PUBLIC_KEY, GOLDEN_SIGN_SECRET_KEY } from "../golden";

function challenge(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("proveKeyPossession / verifyKeyPossession", () => {
  it("round-trips a valid proof", () => {
    const c = challenge("server-issued-nonce");
    expect(verifyKeyPossession(GOLDEN_SIGN_PUBLIC_KEY, c, proveKeyPossession(GOLDEN_SIGN_SECRET_KEY, c))).toBe(true);
  });

  it("fails when the challenge differs", () => {
    const sig = proveKeyPossession(GOLDEN_SIGN_SECRET_KEY, challenge("challenge-A"));
    expect(verifyKeyPossession(GOLDEN_SIGN_PUBLIC_KEY, challenge("challenge-B"), sig)).toBe(false);
  });

  it("fails when signed by a different secret key", () => {
    const seed = new Uint8Array(nacl.sign.seedLength);
    for (let i = 0; i < seed.length; i++) seed[i] = 0x77;
    const other = nacl.sign.keyPair.fromSeed(seed);
    const c = challenge("nonce");
    const sig = proveKeyPossession(bytesToBase64(other.secretKey), c);
    expect(verifyKeyPossession(GOLDEN_SIGN_PUBLIC_KEY, c, sig)).toBe(false);
  });

  it("fails on a garbage signature", () => {
    expect(verifyKeyPossession(GOLDEN_SIGN_PUBLIC_KEY, challenge("nonce"), "AAAA")).toBe(false);
  });

  it("fails on a malformed public key", () => {
    const c = challenge("nonce");
    const sig = proveKeyPossession(GOLDEN_SIGN_SECRET_KEY, c);
    expect(verifyKeyPossession("!!!not-base64!!!", c, sig)).toBe(false);
  });
});

describe("isValidSigningPublicKey", () => {
  it("accepts a well-formed Ed25519 public key", () => {
    expect(isValidSigningPublicKey(GOLDEN_SIGN_PUBLIC_KEY)).toBe(true);
  });

  it("rejects malformed or wrong-length keys", () => {
    expect(isValidSigningPublicKey("not-base64!")).toBe(false);
    expect(isValidSigningPublicKey("AA===")).toBe(false);
  });
});