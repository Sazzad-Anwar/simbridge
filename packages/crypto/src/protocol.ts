/**
 * SIMBridge crypto protocol versioning.
 *
 * Versioning is explicit: the wire payload carries a `version` and a `scheme`
 * string, and any value that is not statically known is rejected. The
 * pre-hardening format (`x25519-xsalsa20-poly1305`, no signature) is treated
 * as protocol version 0 (`LEGACY_V0`) and remains readable during migration —
 * it is never a downgrade path for V1-capable pairs (enforced in Phases 2-4).
 */

import { ENCRYPTION_SCHEME } from "@simbridge/shared";

/** Current protocol version (V1 envelope: signed, replay-protected). */
export const CRYPTO_PROTOCOL_VERSION = 1 as const;

/** Current encryption scheme for V1 envelopes. */
export const CRYPTO_SCHEME = "x25519-xsalsa20-poly1305-v1" as const;

/** Pre-hardening scheme (no signature, no version). Treated as version 0. */
export const LEGACY_V0_SCHEME = ENCRYPTION_SCHEME;

/** Every scheme this build understands, including migration-only V0. */
export const SUPPORTED_SCHEMES = [LEGACY_V0_SCHEME, CRYPTO_SCHEME] as const;
export type SupportedScheme = (typeof SUPPORTED_SCHEMES)[number];

/** True when `scheme` is one of the statically known values. */
export function isKnownScheme(scheme: unknown): scheme is SupportedScheme {
  return typeof scheme === "string" && (SUPPORTED_SCHEMES as readonly string[]).includes(scheme);
}

/**
 * True when `version` is a supported envelope version.
 * V0 (legacy payload) and V1 are recognized; unknown versions are rejected.
 */
export function isKnownVersion(version: unknown): version is 0 | 1 {
  return version === 0 || version === CRYPTO_PROTOCOL_VERSION;
}