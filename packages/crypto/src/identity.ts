/**
 * Device identity: long-term X25519 encryption keys + Ed25519 signing keys,
 * plus a fingerprint binding them together.
 *
 * Identity is generated ONCE per installation (see Phase 2 loadOrCreateIdentity
 * for the strict use/migrate/generate/never-overwrite rules).
 */

import nacl from "tweetnacl";
import { base64ToBytes, bytesToBase64 } from "./base64";
import { randomBytes } from "./random";

export interface DeviceIdentity {
  /** X25519 public key (base64) — encrypted payloads are sent to this. */
  encPublicKey: string;
  /** X25519 secret key (base64) — held only on this device. */
  encSecretKey: string;
  /** Ed25519 public key (base64) — verifies V1 envelope signatures. */
  signPublicKey: string;
  /** Ed25519 secret key (base64) — held only on this device. */
  signSecretKey: string;
  /**
   * Fingerprint of the identity: first 32 bytes of SHA-512(encPublicKey ‖
   * signPublicKey), base64. Shown to the peer during pairing.
   */
  fingerprint: string;
}

/** Derive a stable identity fingerprint from the two public keys. */
export function fingerprintOf(encPublicKeyB64: string, signPublicKeyB64: string): string {
  const enc = base64ToBytes(encPublicKeyB64);
  const sign = base64ToBytes(signPublicKeyB64);
  const material = new Uint8Array(enc.length + sign.length);
  material.set(enc, 0);
  material.set(sign, enc.length);
  const digest = nacl.hash(material); // SHA-512
  return bytesToBase64(digest.subarray(0, 32));
}

/** Generate an Ed25519 signing key pair for an existing device identity. */
export function generateSigningKeyPair(): { signPublicKey: string; signSecretKey: string } {
  const signSeed = randomBytes(nacl.sign.seedLength);
  const signKp = nacl.sign.keyPair.fromSeed(signSeed);
  return {
    signPublicKey: bytesToBase64(signKp.publicKey),
    signSecretKey: bytesToBase64(signKp.secretKey),
  };
}

/** Generate a fresh device identity (encryption + signing key pairs). */
export function generateDeviceIdentity(): DeviceIdentity {
  const encSecretKey = randomBytes(nacl.box.secretKeyLength);
  const encPublicKey = nacl.scalarMult.base(encSecretKey);

  const sign = generateSigningKeyPair();

  const identity: DeviceIdentity = {
    encPublicKey: bytesToBase64(encPublicKey),
    encSecretKey: bytesToBase64(encSecretKey),
    signPublicKey: sign.signPublicKey,
    signSecretKey: sign.signSecretKey,
    fingerprint: "",
  };
  identity.fingerprint = fingerprintOf(identity.encPublicKey, identity.signPublicKey);
  return identity;
}