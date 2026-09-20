/**
 * Proof of possession (PoP) for device signing keys.
 *
 * The server issues a cryptographically random, single-use, short-lived
 * challenge; the device signs the raw challenge bytes with its Ed25519 secret
 * key; the server verifies the result against the key that is (or is being)
 * registered. A signing key is therefore never "accepted merely because the
 * client supplied it".
 */

import nacl from "tweetnacl";
import { base64ToBytes, bytesToBase64 } from "./base64";

/**
 * Sign a server-issued challenge with the device's Ed25519 secret key.
 * Returns the base64 signature.
 */
export function proveKeyPossession(signSecretKeyB64: string, challenge: Uint8Array): string {
  const secretKey = base64ToBytes(signSecretKeyB64);
  if (secretKey.length !== nacl.sign.secretKeyLength) {
    throw new Error("Invalid Ed25519 secret key");
  }
  return bytesToBase64(nacl.sign.detached(challenge, secretKey));
}

/**
 * Verify that `signature` is a valid PoP over `challenge` for the given
 * Ed25519 public key. Never throws for bad inputs — returns false.
 */
export function verifyKeyPossession(
  signPublicKeyB64: string,
  challenge: Uint8Array,
  signatureB64: string,
): boolean {
  let publicKey: Uint8Array;
  let signature: Uint8Array;
  try {
    publicKey = base64ToBytes(signPublicKeyB64);
    signature = base64ToBytes(signatureB64);
  } catch {
    return false;
  }
  if (publicKey.length !== nacl.sign.publicKeyLength) {
    return false;
  }
  if (signature.length !== nacl.sign.signatureLength) {
    return false;
  }
  try {
    return nacl.sign.detached.verify(challenge, signature, publicKey);
  } catch {
    return false;
  }
}

/** Sanity check for a base64 Ed25519 signing public key. Never throws. */
export function isValidSigningPublicKey(signPublicKeyB64: string): boolean {
  try {
    return base64ToBytes(signPublicKeyB64).length === nacl.sign.publicKeyLength;
  } catch {
    return false;
  }
}