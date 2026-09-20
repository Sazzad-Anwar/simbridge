/**
 * V1 encrypted envelope.
 *
 * A signed hybrid-encryption envelope sent from a SIM sender to a receiver:
 *
 *   - plaintext is sealed with NaCl `box` (ephemeral X25519 + XSalsa20-
 *     Poly1305) against the RECEIVER's long-term X25519 public key;
 *   - the resulting envelope fields are canonicalized and signed with the
 *     SENDER's Ed25519 secret key, and the sender's key fingerprint is
 *     included in the signed bytes;
 *   - recipients verify `senderSignKeyFingerprint` and the Ed25519 signature
 *     before decrypting. The backend never sees plaintext.
 */

import nacl from "tweetnacl";
import type { EncryptedPayload } from "@simbridge/shared";
import { CRYPTO_SCHEME, CRYPTO_PROTOCOL_VERSION, LEGACY_V0_SCHEME } from "./protocol";
import { cryptoError } from "./errors";
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from "./base64";
import { randomBytes } from "./random";
import { type EnvelopeV1Fields } from "./canonicalize";
import { signEnvelopeV1, verifyEnvelopeV1 } from "./sign";

/** Fully-rendered V1 envelope including its Ed25519 signature. */
export interface EncryptedEnvelopeV1 extends EnvelopeV1Fields {
  signature: string;
}

export interface EncryptMessageV1Input {
  /** Client-issued globally unique id; part of the signed canonical bytes. */
  messageId: string;
  pairId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  /** Sender Ed25519 key fingerprint; included in the signed canonical bytes. */
  senderSignKeyFingerprint: string;
  /** Receiver's long-term X25519 public key (base64). */
  receiverEncPublicKey: string;
  /** Sender's Ed25519 secret key (base64) used to sign the envelope. */
  senderSignSecretKey: string;
  plaintext: string;
  /** ISO-8601 timestamp from the sender's clock; optional (defaults to now). */
  createdAt?: string;
}

export interface DecryptEnvelopeV1Input {
  envelope: EncryptedEnvelopeV1;
  /** Receiver's long-term X25519 secret key (base64). */
  receiverEncSecretKey: string;
  /** Sender's Ed25519 public key (base64) registered and pinned at pairing. */
  senderSignPublicKey: string;
  /** The sender fingerprint the receiver pinned at pairing time. */
  expectedSenderSignKeyFingerprint: string;
}

/** Parse and shape-check an unknown value into a V1 envelope. */
export function decodeEnvelopeV1(value: unknown): EncryptedEnvelopeV1 {
  if (typeof value !== "object" || value === null) {
    throw cryptoError("INVALID_ENVELOPE", "Envelope must be an object");
  }
  const e = value as Record<string, unknown>;
  if (e.version !== CRYPTO_PROTOCOL_VERSION) {
    throw cryptoError("UNKNOWN_PROTOCOL_VERSION", `Unsupported protocol version: ${e.version}`);
  }
  if (e.scheme !== CRYPTO_SCHEME) {
    throw cryptoError("UNKNOWN_SCHEME", `Unsupported encryption scheme: ${e.scheme}`);
  }
  if (typeof e.signature !== "string" || e.signature.length === 0) {
    throw cryptoError("INVALID_ENVELOPE", "Missing envelope signature");
  }
  return {
    version: CRYPTO_PROTOCOL_VERSION,
    scheme: CRYPTO_SCHEME,
    messageId: e.messageId as string,
    pairId: e.pairId as string,
    senderDeviceId: e.senderDeviceId as string,
    receiverDeviceId: e.receiverDeviceId as string,
    senderSignKeyFingerprint: e.senderSignKeyFingerprint as string,
    ephemPublicKey: e.ephemPublicKey as string,
    nonce: e.nonce as string,
    ciphertext: e.ciphertext as string,
    createdAt: e.createdAt as string,
    signature: e.signature,
  };
}

/** Low-level no-signature shape used as input to `signEnvelopeV1`. */
export function toEnvelopeV1Fields(input: {
  messageId: string;
  pairId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  senderSignKeyFingerprint: string;
  ephemPublicKey: string;
  nonce: string;
  ciphertext: string;
  createdAt: string;
}): EnvelopeV1Fields {
  return {
    version: CRYPTO_PROTOCOL_VERSION,
    scheme: CRYPTO_SCHEME,
    messageId: input.messageId,
    pairId: input.pairId,
    senderDeviceId: input.senderDeviceId,
    receiverDeviceId: input.receiverDeviceId,
    senderSignKeyFingerprint: input.senderSignKeyFingerprint,
    ephemPublicKey: input.ephemPublicKey,
    nonce: input.nonce,
    ciphertext: input.ciphertext,
    createdAt: input.createdAt,
  };
}

/** Encrypt `plaintext` for a receiver and return the signed V1 envelope. */
export function encryptMessageV1(input: EncryptMessageV1Input): EncryptedEnvelopeV1 {
  const recipient = base64ToBytes(input.receiverEncPublicKey);
  if (recipient.length !== nacl.box.publicKeyLength) {
    throw cryptoError("INVALID_ENVELOPE", "Invalid receiver public key");
  }
  const ephemeralSecretKey = randomBytes(nacl.box.secretKeyLength);
  const ephemeralPublicKey = nacl.scalarMult.base(ephemeralSecretKey);
  const nonce = randomBytes(nacl.box.nonceLength);
  const boxed = nacl.box(utf8ToBytes(input.plaintext), nonce, recipient, ephemeralSecretKey);

  const fields: EnvelopeV1Fields = {
    version: CRYPTO_PROTOCOL_VERSION,
    scheme: CRYPTO_SCHEME,
    messageId: input.messageId,
    pairId: input.pairId,
    senderDeviceId: input.senderDeviceId,
    receiverDeviceId: input.receiverDeviceId,
    senderSignKeyFingerprint: input.senderSignKeyFingerprint,
    ephemPublicKey: bytesToBase64(ephemeralPublicKey),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(boxed),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const signature = signEnvelopeV1(fields, input.senderSignSecretKey);
  return { ...fields, signature };
}

/**
 * Decrypt a V1 envelope. Fails closed in this order:
 *  fingerprint mismatch -> signature invalid -> decryption (tamper/key) failure.
 */
export function decryptEnvelopeV1(input: DecryptEnvelopeV1Input): string {
  const { envelope, expectedSenderSignKeyFingerprint } = input;

  if (envelope.senderSignKeyFingerprint !== expectedSenderSignKeyFingerprint) {
    throw cryptoError(
      "FINGERPRINT_MISMATCH",
      "Sender signing-key fingerprint does not match the pinned value",
    );
  }
  if (!verifyEnvelopeV1(envelope, input.senderSignPublicKey, envelope.signature)) {
    throw cryptoError("INVALID_SIGNATURE", "Envelope signature verification failed");
  }

  const secret = base64ToBytes(input.receiverEncSecretKey);
  const ephemeral = base64ToBytes(envelope.ephemPublicKey);
  const nonce = base64ToBytes(envelope.nonce);
  const boxed = base64ToBytes(envelope.ciphertext);
  const opened = nacl.box.open(boxed, nonce, ephemeral, secret);
  if (!opened) {
    throw cryptoError("DECRYPTION_FAILED", "Decryption failed (wrong key or tampered payload)");
  }
  return bytesToUtf8(opened);
}

export type NormalizedPayload =
  | { kind: "legacy-v0"; payload: EncryptedPayload }
  | { kind: "v1"; envelope: EncryptedEnvelopeV1 };

/**
 * Route an incoming payload (as stored/relayed by the backend) to either the
 * legacy V0 format or the signed V1 envelope. Unknown values throw.
 */
export function normalizePayload(value: unknown): NormalizedPayload {
  if (typeof value !== "object" || value === null) {
    throw cryptoError("INVALID_ENVELOPE", "Payload must be an object");
  }
  const p = value as Record<string, unknown>;
  if (p.version === undefined || p.signature === undefined) {
    if (p.scheme === LEGACY_V0_SCHEME) {
      return { kind: "legacy-v0", payload: p as unknown as EncryptedPayload };
    }
    throw cryptoError("UNKNOWN_SCHEME", `Unknown encryption scheme: ${p.scheme}`);
  }
  return { kind: "v1", envelope: decodeEnvelopeV1(value) };
}