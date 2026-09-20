/**
 * Deterministic canonicalization for the V1 envelope.
 *
 * The exact bytes produced here are signed by the sender, verified by the
 * backend, and verified again by the receiver. Field order, length encoding
 * and the magic prefix are fixed — no JSON stringify, no key ordering, no
 * locale-sensitive formatting. Canonical bytes are therefore identical on the
 * sender, the backend and the receiver for the same logical envelope.
 *
 * Format (`canonical-v1`), concatenated UTF-8 bytes:
 *   magic : "SIMBRIDGE/ENVELOPE/V1\0"
 *   then, for each field in CANONICAL_FIELD_KEYS order:
 *     version  -> u32 big-endian
 *     strings  -> u32 big-endian byte-length followed by the UTF-8 bytes
 */

import { CRYPTO_SCHEME, CRYPTO_PROTOCOL_VERSION } from "./protocol";
import { cryptoError } from "./errors";
import { utf8ToBytes } from "./base64";

/** Magic prefix that locks the canonical format used for V1 signatures. */
export const CANONICAL_MAGIC = "SIMBRIDGE/ENVELOPE/V1\0";

/** Signed fields in fixed byte order. `signature` itself is excluded. */
export const CANONICAL_FIELD_KEYS = [
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
] as const;
export type CanonicalFieldKey = (typeof CANONICAL_FIELD_KEYS)[number];

/** A V1 envelope without its signature - the exact shape that gets canonicalized. */
export interface EnvelopeV1Fields {
  version: typeof CRYPTO_PROTOCOL_VERSION;
  scheme: typeof CRYPTO_SCHEME;
  messageId: string;
  pairId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  senderSignKeyFingerprint: string;
  ephemPublicKey: string;
  nonce: string;
  ciphertext: string;
  createdAt: string;
}

function encodeU32BE(value: number, out: number[]): void {
  out.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function encodeString(value: string, out: number[]): void {
  const bytes = utf8ToBytes(value);
  encodeU32BE(bytes.length, out);
  for (let i = 0; i < bytes.length; i++) out.push(bytes[i]);
}

/**
 * Produce the canonical bytes for a V1 envelope's signed fields.
 * Throws `INVALID_ENVELOPE` if any field is missing or of the wrong type.
 */
export function canonicalizeV1(envelope: Partial<EnvelopeV1Fields>): Uint8Array {
  const out: number[] = [];
  for (const b of utf8ToBytes(CANONICAL_MAGIC)) out.push(b);

  for (const key of CANONICAL_FIELD_KEYS) {
    const value = envelope[key];
    if (key === "version") {
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 0xffffffff
      ) {
        throw cryptoError("INVALID_ENVELOPE", `Canonical field '${key}' must be a u32`);
      }
      encodeU32BE(value, out);
    } else {
      if (typeof value !== "string") {
        throw cryptoError("INVALID_ENVELOPE", `Canonical field '${key}' must be a string`);
      }
      encodeString(value, out);
    }
  }

  return new Uint8Array(out);
}