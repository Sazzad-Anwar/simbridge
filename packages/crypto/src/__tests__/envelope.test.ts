import { describe, it, expect } from "vitest";
import {
  encryptMessageV1,
  decryptEnvelopeV1,
  decodeEnvelopeV1,
  normalizePayload,
} from "../envelope";
import { CryptoError } from "../errors";
import { generateKeyPair } from "../index";
import {
  GOLDEN_ENVELOPE,
  GOLDEN_FINGERPRINT,
  GOLDEN_SIGN_PUBLIC_KEY,
  GOLDEN_SIGN_SECRET_KEY,
  GOLDEN_ENC_PUBLIC_KEY,
  GOLDEN_ENC_SECRET_KEY,
  GOLDEN_OTHER_SIGN_PUBLIC_KEY,
} from "../golden";
import { CRYPTO_SCHEME, CRYPTO_PROTOCOL_VERSION, LEGACY_V0_SCHEME } from "../protocol";

const INPUT = {
  messageId: "msg_encrypt-test-0000-0000-0000-000000000001",
  pairId: "pair_encrypt-test-0000-0000-0000-000000000002",
  senderDeviceId: "dev_sender-test-0000-0000-0000-000000000003",
  receiverDeviceId: "dev_receiver-test-0000-0000-0000-000000000004",
  senderSignKeyFingerprint: GOLDEN_FINGERPRINT,
  receiverEncPublicKey: GOLDEN_ENC_PUBLIC_KEY,
  senderSignSecretKey: GOLDEN_SIGN_SECRET_KEY,
  plaintext: "hello, SIMBridge",
  createdAt: "2026-09-20T11:00:00.000Z",
} as const;

describe("encryptMessageV1 / decryptEnvelopeV1", () => {
  it("round-trips plaintext", () => {
    const envelope = encryptMessageV1(INPUT);
    const out = decryptEnvelopeV1({
      envelope,
      receiverEncSecretKey: GOLDEN_ENC_SECRET_KEY,
      senderSignPublicKey: GOLDEN_SIGN_PUBLIC_KEY,
      expectedSenderSignKeyFingerprint: GOLDEN_FINGERPRINT,
    });
    expect(out).toBe(INPUT.plaintext);
  });

  it("produces a fresh ephemeral key and nonce per message", () => {
    const a = encryptMessageV1(INPUT);
    const b = encryptMessageV1(INPUT);
    expect(a.ephemPublicKey).not.toBe(b.ephemPublicKey);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it("is replay/dedup-safe on identical plaintext (different ciphertexts)", () => {
    const a = encryptMessageV1(INPUT);
    const b = encryptMessageV1(INPUT);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("fails closed on wrong receiver secret key", () => {
    const envelope = encryptMessageV1(INPUT);
    const wrongReceiver = generateKeyPair().secretKey; // some other device's key
    try {
      decryptEnvelopeV1({
        envelope,
        receiverEncSecretKey: wrongReceiver,
        senderSignPublicKey: GOLDEN_SIGN_PUBLIC_KEY,
        expectedSenderSignKeyFingerprint: GOLDEN_FINGERPRINT,
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("DECRYPTION_FAILED");
    }
  });

  it("fails closed on sender fingerprint mismatch (before decrypt)", () => {
    const envelope = encryptMessageV1(INPUT);
    try {
      decryptEnvelopeV1({
        envelope,
        receiverEncSecretKey: GOLDEN_ENC_SECRET_KEY,
        senderSignPublicKey: GOLDEN_SIGN_PUBLIC_KEY,
        expectedSenderSignKeyFingerprint: "0000000000000000000000000000000000000000000000000000000000000000",
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("FINGERPRINT_MISMATCH");
    }
  });

  it("fails closed on invalid signature", () => {
    const envelope = { ...encryptMessageV1(INPUT), signature: "AAAA" };
    try {
      decryptEnvelopeV1({
        envelope,
        receiverEncSecretKey: GOLDEN_ENC_SECRET_KEY,
        senderSignPublicKey: GOLDEN_SIGN_PUBLIC_KEY,
        expectedSenderSignKeyFingerprint: GOLDEN_FINGERPRINT,
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("INVALID_SIGNATURE");
    }
  });

  it.each([
    "messageId",
    "pairId",
    "senderDeviceId",
    "receiverDeviceId",
    "ephemPublicKey",
    "nonce",
    "ciphertext",
    "createdAt",
  ] as const)("fails closed with INVALID_SIGNATURE when '%s' is tampered after signing", (field) => {
    const envelope = encryptMessageV1(INPUT);
    const tampered = { ...envelope, [field]: `${envelope[field]}Z` };
    try {
      decryptEnvelopeV1({
        envelope: tampered,
        receiverEncSecretKey: GOLDEN_ENC_SECRET_KEY,
        senderSignPublicKey: GOLDEN_SIGN_PUBLIC_KEY,
        expectedSenderSignKeyFingerprint: GOLDEN_FINGERPRINT,
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("INVALID_SIGNATURE");
    }
  });

  it("fails closed with FINGERPRINT_MISMATCH when senderSignKeyFingerprint is tampered (checked first)", () => {
    const envelope = encryptMessageV1(INPUT);
    const tampered = { ...envelope, senderSignKeyFingerprint: `${envelope.senderSignKeyFingerprint}Z` };
    try {
      decryptEnvelopeV1({
        envelope: tampered,
        receiverEncSecretKey: GOLDEN_ENC_SECRET_KEY,
        senderSignPublicKey: GOLDEN_SIGN_PUBLIC_KEY,
        expectedSenderSignKeyFingerprint: GOLDEN_FINGERPRINT,
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("FINGERPRINT_MISMATCH");
    }
  });

  it("rejects envelopes signed by an unregistered sender key", () => {
    const wrong = { ...INPUT, senderSignSecretKey: GOLDEN_SIGN_SECRET_KEY };
    const envelope = encryptMessageV1(wrong); // still golden; verified against golden pub
    // verify against a DIFFERENT (seed-derived) public key than the signer => fails
    try {
      decryptEnvelopeV1({
        envelope,
        receiverEncSecretKey: GOLDEN_ENC_SECRET_KEY,
        senderSignPublicKey: GOLDEN_OTHER_SIGN_PUBLIC_KEY, // not the golden signer
        expectedSenderSignKeyFingerprint: GOLDEN_FINGERPRINT,
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("INVALID_SIGNATURE");
    }
  });
});

describe("decodeEnvelopeV1", () => {
  it("decodes a valid envelope", () => {
    const envelope = encryptMessageV1(INPUT);
    const decoded = decodeEnvelopeV1(envelope);
    expect(decoded.messageId).toBe(INPUT.messageId);
  });

  it("rejects an unknown protocol version", () => {
    const envelope = { ...encryptMessageV1(INPUT), version: 99 };
    try {
      decodeEnvelopeV1(envelope);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("UNKNOWN_PROTOCOL_VERSION");
    }
  });

  it("rejects an unknown scheme", () => {
    const envelope = { ...encryptMessageV1(INPUT), scheme: "totally-bogus" };
    try {
      decodeEnvelopeV1(envelope);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("UNKNOWN_SCHEME");
    }
  });

  it("rejects a missing signature", () => {
    const envelope = encryptMessageV1(INPUT);
    delete (envelope as Partial<typeof envelope>).signature;
    try {
      decodeEnvelopeV1(envelope);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("INVALID_ENVELOPE");
    }
  });
});

describe("normalizePayload", () => {
  it("routes a V1 envelope to kind 'v1'", () => {
    const envelope = encryptMessageV1({ ...INPUT, version: CRYPTO_PROTOCOL_VERSION });
    const result = normalizePayload(envelope);
    expect(result.kind).toBe("v1");
  });

  it("routes a legacy V0 payload to kind 'legacy-v0'", () => {
    const legacy = {
      ciphertext: "AAAA",
      ephemPublicKey: GOLDEN_ENC_PUBLIC_KEY,
      nonce: "BBBB",
      scheme: LEGACY_V0_SCHEME,
    };
    const result = normalizePayload(legacy);
    expect(result.kind).toBe("legacy-v0");
  });

  it("rejects an unknown scheme", () => {
    try {
      normalizePayload({ scheme: "nope", ciphertext: "A", ephemPublicKey: "B", nonce: "C" });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("UNKNOWN_SCHEME");
    }
  });

  it("recognizes the V1 scheme constant", () => {
    expect(CRYPTO_SCHEME).toBe("x25519-xsalsa20-poly1305-v1");
  });
});