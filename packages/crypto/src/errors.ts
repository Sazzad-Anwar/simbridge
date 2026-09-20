/**
 * SIMBridge crypto error model.
 *
 * Every failure surfaces as a `CryptoError` carrying a stable machine-readable
 * `code` so the API and both mobile apps can react without string matching.
 */

export const CRYPTO_ERROR_CODES = {
  UNKNOWN_PROTOCOL_VERSION: "UNKNOWN_PROTOCOL_VERSION",
  UNKNOWN_SCHEME: "UNKNOWN_SCHEME",
  INVALID_ENVELOPE: "INVALID_ENVELOPE",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  FINGERPRINT_MISMATCH: "FINGERPRINT_MISMATCH",
  KEY_UNVERIFIED: "KEY_UNVERIFIED",
  POP_FAILED: "POP_FAILED",
  DECRYPTION_FAILED: "DECRYPTION_FAILED",
  VAULT_KEY_MISSING: "VAULT_KEY_MISSING",
  LOCAL_STORAGE_RECOVERY_REQUIRED: "LOCAL_STORAGE_RECOVERY_REQUIRED",
  PAIR_PROTOCOL_MISMATCH: "PAIR_PROTOCOL_MISMATCH",
} as const;
export type CryptoErrorCode = (typeof CRYPTO_ERROR_CODES)[keyof typeof CRYPTO_ERROR_CODES];

export class CryptoError extends Error {
  readonly code: CryptoErrorCode;

  constructor(code: CryptoErrorCode, message: string) {
    super(message);
    this.name = "CryptoError";
    this.code = code;
  }
}

/** Build a typed CryptoError for a given code. */
export function cryptoError(code: CryptoErrorCode, message: string): CryptoError {
  return new CryptoError(code, message);
}