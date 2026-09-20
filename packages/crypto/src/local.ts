/**
 * Device-local at-rest vault (secretbox).
 *
 * The JS offline outbox and receiver message cache are encrypted at rest with
 * a device-local 32-byte secretbox key stored in the platform secure store
 * (expo-secure-store / Keystore). The key is generated ONCE on first
 * installation; a missing key is never silently regenerated and encrypted data
 * is never deleted — callers must surface VAULT_KEY_MISSING and keep the data
 * for recovery (enforced in Phase 4).
 */

import nacl from "tweetnacl";
import { bytesToBase64, base64ToBytes } from "./base64";
import { randomBytes } from "./random";
import { cryptoError } from "./errors";

/** Length of an AES-256-equivalent secretbox key. */
export const VAULT_KEY_LENGTH = nacl.secretbox.keyLength;

/** Generate a fresh device-local vault key (32 random bytes, base64). */
export function generateVaultKey(): string {
  return bytesToBase64(randomBytes(VAULT_KEY_LENGTH));
}

/**
 * Encrypt bytes with the device-local vault key.
 * Output: base64( nonce ‖ sealed ), where nonce is 24 random bytes.
 */
export function encryptLocal(vaultKeyB64: string, data: Uint8Array): string {
  const key = base64ToBytes(vaultKeyB64);
  if (key.length !== VAULT_KEY_LENGTH) {
    throw cryptoError("INVALID_ENVELOPE", "Invalid vault key");
  }
  const nonce = randomBytes(nacl.secretbox.nonceLength);
  const sealed = nacl.secretbox(data, nonce, key);
  const out = new Uint8Array(nonce.length + sealed.length);
  out.set(nonce, 0);
  out.set(sealed, nonce.length);
  return bytesToBase64(out);
}

/** Decrypt bytes produced by `encryptLocal`. Throws on tamper/wrong key. */
export function decryptLocal(vaultKeyB64: string, sealedB64: string): Uint8Array {
  const key = base64ToBytes(vaultKeyB64);
  if (key.length !== VAULT_KEY_LENGTH) {
    throw cryptoError("INVALID_ENVELOPE", "Invalid vault key");
  }
  const packed = base64ToBytes(sealedB64);
  if (packed.length < nacl.secretbox.nonceLength + nacl.secretbox.overheadLength) {
    throw cryptoError("DECRYPTION_FAILED", "Vault payload is too short to decrypt");
  }
  const nonce = packed.subarray(0, nacl.secretbox.nonceLength);
  const sealed = packed.subarray(nacl.secretbox.nonceLength);
  const opened = nacl.secretbox.open(sealed, nonce, key);
  if (!opened) {
    throw cryptoError("DECRYPTION_FAILED", "Vault decryption failed");
  }
  return opened;
}

/**
 * Error to surface when the vault key is missing from secure storage while
 * encrypted vault data exists. Callers MUST NOT regenerate a key, delete the
 * data or clear the outbox automatically — recovery is user-directed.
 */
export function vaultKeyMissingError(): Error {
  return cryptoError(
    "VAULT_KEY_MISSING",
    "Device vault key is missing while encrypted data exists; recovery required",
  );
}

/**
 * Error to surface when local encrypted data cannot be recovered (key present
 * but data corrupt). Encrypted data is preserved untouched for recovery.
 */
export function localStorageRecoveryRequiredError(): Error {
  return cryptoError(
    "LOCAL_STORAGE_RECOVERY_REQUIRED",
    "Local encrypted data is not recoverable; data preserved for recovery",
  );
}