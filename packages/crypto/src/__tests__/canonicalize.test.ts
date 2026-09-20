import { describe, it, expect } from "vitest";
import { canonicalizeV1, CANONICAL_MAGIC, CANONICAL_FIELD_KEYS } from "../canonicalize";
import { CryptoError } from "../errors";
import { GOLDEN_CANONICAL_HEX, GOLDEN_ENVELOPE } from "../golden";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("canonicalizeV1", () => {
  it("produces the locked golden bytes for the golden envelope", () => {
    expect(toHex(canonicalizeV1(GOLDEN_ENVELOPE))).toBe(GOLDEN_CANONICAL_HEX);
  });

  it("does not depend on input property order (deterministic)", () => {
    const { scheme, ...rest } = GOLDEN_ENVELOPE;
    const reordered = { scheme, ...rest } as typeof GOLDEN_ENVELOPE;
    expect(toHex(canonicalizeV1(reordered))).toBe(GOLDEN_CANONICAL_HEX);
  });

  it("empty-string differences change the bytes (no normalization)", () => {
    expect(toHex(canonicalizeV1({ ...GOLDEN_ENVELOPE, messageId: "" }))).not.toBe(
      GOLDEN_CANONICAL_HEX,
    );
  });

  it("emits the magic prefix first", () => {
    const bytes = canonicalizeV1(GOLDEN_ENVELOPE);
    const prefix = Array.from(bytes.slice(0, CANONICAL_MAGIC.length))
      .map((b) => String.fromCharCode(b))
      .join("");
    expect(prefix).toBe(CANONICAL_MAGIC);
  });

  it.each(CANONICAL_FIELD_KEYS)("throws INVALID_ENVELOPE when '%s' is missing", (key) => {
    const bad = { ...GOLDEN_ENVELOPE, [key]: undefined };
    try {
      canonicalizeV1(bad as never);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CryptoError);
      expect((e as CryptoError).code).toBe("INVALID_ENVELOPE");
    }
  });

  it("rejects a non-u32 version", () => {
    try {
      canonicalizeV1({ ...GOLDEN_ENVELOPE, version: "1" } as never);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as CryptoError).code).toBe("INVALID_ENVELOPE");
    }
  });
});