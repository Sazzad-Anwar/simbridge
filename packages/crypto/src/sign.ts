/**
 * Ed25519 envelope signing for V1 messages.
 *
 * Signatures bind every authenticated field of the envelope (including
 * `senderSignKeyFingerprint` and the routing metadata) to the canonical bytes
 * produced by `canonicalizeV1`. Uses tweetnacl's `sign.detached` (Ed25519) —
 * no new runtime dependency.
 */

import nacl from "tweetnacl";
import { canonicalizeV1, type EnvelopeV1Fields } from "./canonicalize";
import { base64ToBytes, bytesToBase64 } from "./base64";
import { cryptoError } from "./errors";

/** Sign a V1 envelope's canonical bytes with the sender's Ed25519 secret key. */
export function signEnvelopeV1(
  envelope: EnvelopeV1Fields,
  signSecretKeyB64: string,
): string {
  const secretKey = base64ToBytes(signSecretKeyB64);
  if (secretKey.length !== nacl.sign.secretKeyLength) {
    throw cryptoError("INVALID_ENVELOPE", "Invalid Ed25519 secret key");
  }
  const canonical = canonicalizeV1(envelope);
  return bytesToBase64(nacl.sign.detached(canonical, secretKey));
}

/** Verify a V1 envelope signature against a sender Ed25519 public key. Total (never throws). */
export function verifyEnvelopeV1(
  envelope: EnvelopeV1Fields,
  signPublicKeyB64: string,
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
  let canonical: Uint8Array;
  try {
    canonical = canonicalizeV1(envelope);
  } catch {
    return false;
  }
  return nacl.sign.detached.verify(canonical, signature, publicKey);
}