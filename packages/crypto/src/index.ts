/**
 * SIMBridge end-to-end encryption.
 *
 * Hybrid ECIES-style scheme:
 *   1. Every device generates a long-term X25519 key pair at registration.
 *   2. To send a message, the sender generates an EPHEMERAL X25519 key pair
 *      and a random 24-byte nonce, then seals the plaintext with
 *      NaCl `box` (X25519 + XSalsa20-Poly1305) against the RECEIVER's public key.
 *   3. Only the receiver's private key can open the box.
 *
 * The backend only ever sees `{ ciphertext, ephemPublicKey, nonce }` —
 * it stores and relays opaque blobs and can never read message content.
 */

import nacl from "tweetnacl";
import { ENCRYPTION_SCHEME } from "@simbridge/shared";
import type { EncryptedPayload } from "@simbridge/shared";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  utf8ToBytes,
} from "./base64";

export { bytesToBase64, base64ToBytes, utf8ToBytes, bytesToUtf8 };

export interface KeyPairB64 {
  publicKey: string;
  secretKey: string;
}

/** CSPRNG that works on Node.js and React Native. */
export function randomBytes(length: number): Uint8Array {
  const g = globalThis as { crypto?: { getRandomValues(b: Uint8Array): Uint8Array } };
  const crypto = g.crypto;
  if (!crypto || typeof crypto.getRandomValues !== "function") {
    throw new Error(
      "crypto.getRandomValues unavailable. On React Native, polyfill it with expo-crypto before importing @simbridge/crypto.",
    );
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Generate a device identity key pair (base64 encoded X25519). */
export function generateKeyPair(): KeyPairB64 {
  const kp = nacl.box.keyPair();
  return {
    publicKey: bytesToBase64(kp.publicKey),
    secretKey: bytesToBase64(kp.secretKey),
  };
}

/** Derive the public key from a stored secret key (used to verify local state). */
export function publicKeyFromSecret(secretKeyB64: string): string {
  const secret = base64ToBytes(secretKeyB64);
  const kp = nacl.box.keyPair.fromSecretKey(secret);
  return bytesToBase64(kp.publicKey);
}

/** Basic sanity check for a base64 X25519 public key. */
export function isValidPublicKey(publicKeyB64: string): boolean {
  try {
    return base64ToBytes(publicKeyB64).length === nacl.box.publicKeyLength;
  } catch {
    return false;
  }
}

/**
 * Encrypt a UTF-8 string for a recipient public key.
 * Returns the payload the backend stores/relays (never readable server-side).
 */
export function encrypt(receiverPublicKeyB64: string, plaintext: string): EncryptedPayload {
  const recipient = base64ToBytes(receiverPublicKeyB64);
  if (recipient.length !== nacl.box.publicKeyLength) {
    throw new Error("Invalid receiver public key");
  }
  const ephemeral = nacl.box.keyPair();
  const nonce = randomBytes(nacl.box.nonceLength);
  const boxed = nacl.box(utf8ToBytes(plaintext), nonce, recipient, ephemeral.secretKey);
  return {
    ciphertext: bytesToBase64(boxed),
    ephemPublicKey: bytesToBase64(ephemeral.publicKey),
    nonce: bytesToBase64(nonce),
    scheme: ENCRYPTION_SCHEME,
  };
}

/** Decrypt a payload with the local (receiver) secret key. Throws on tamper/failure. */
export function decrypt(mySecretKeyB64: string, payload: EncryptedPayload): string {
  if (payload.scheme !== ENCRYPTION_SCHEME) {
    throw new Error(`Unsupported encryption scheme: ${payload.scheme}`);
  }
  const secret = base64ToBytes(mySecretKeyB64);
  const ephemeral = base64ToBytes(payload.ephemPublicKey);
  const nonce = base64ToBytes(payload.nonce);
  const boxed = base64ToBytes(payload.ciphertext);
  const opened = nacl.box.open(boxed, nonce, ephemeral, secret);
  if (!opened) throw new Error("Decryption failed (wrong key or tampered payload)");
  return bytesToUtf8(opened);
}

/** Convenience wrapper for encrypting JSON-serializable objects. */
export function encryptJson(receiverPublicKeyB64: string, value: unknown): EncryptedPayload {
  return encrypt(receiverPublicKeyB64, JSON.stringify(value));
}

/** Convenience wrapper for decrypting JSON-serializable objects. */
export function decryptJson<T = unknown>(mySecretKeyB64: string, payload: EncryptedPayload): T {
  return JSON.parse(decrypt(mySecretKeyB64, payload)) as T;
}
