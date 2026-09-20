import { describe, it, expect } from "vitest";
import {
  generateVaultKey,
  encryptLocal,
  decryptLocal,
  VAULT_KEY_LENGTH,
  vaultKeyMissingError,
  localStorageRecoveryRequiredError,
} from "../local";
import { CryptoError } from "../errors";
import { utf8ToBytes, bytesToUtf8 } from "../base64";

describe("local at-rest vault", () => {
  it("round-trips bytes", () => {
    const key = generateVaultKey();
    const sealed = encryptLocal(key, utf8ToBytes("encrypted-outbox-entry"));
    expect(bytesToUtf8(decryptLocal(key, sealed))).toBe("encrypted-outbox-entry");
  });

  it("creates unique sealed blobs for the same plaintext", () => {
    const key = generateVaultKey();
    const data = utf8ToBytes("same");
    expect(encryptLocal(key, data)).not.toBe(encryptLocal(key, data));
  });

  it("fails closed on the wrong key", () => {
    const a = generateVaultKey();
    const b = generateVaultKey();
    const sealed = encryptLocal(a, utf8ToBytes("secret"));
    try {
      decryptLocal(b, sealed);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("DECRYPTION_FAILED");
    }
  });

  it("fails closed on a truncated/corrupt sealed blob", () => {
    const key = generateVaultKey();
    const sealed = encryptLocal(key, utf8ToBytes("secret"));
    try {
      decryptLocal(key, sealed.slice(0, 8) + "AAAA");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("DECRYPTION_FAILED");
    }
    try {
      decryptLocal(key, "AAAA");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("DECRYPTION_FAILED");
    }
  });

  it("generates keys of the correct length", () => {
    expect(VAULT_KEY_LENGTH).toBe(32);
    expect(generateVaultKey().length).toBeGreaterThan(40);
  });

  it("vault-key-missing surfaces the dedicated code (no auto-generation)", () => {
    const err = vaultKeyMissingError() as CryptoError;
    expect(err.code).toBe("VAULT_KEY_MISSING");
  });

  it("local-storage-recovery surfaces the dedicated code", () => {
    const err = localStorageRecoveryRequiredError() as CryptoError;
    expect(err.code).toBe("LOCAL_STORAGE_RECOVERY_REQUIRED");
  });
});