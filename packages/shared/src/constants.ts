/**
 * SIMBridge — shared domain constants.
 * Used by the API (Elysia.js) and both mobile apps (sender / receiver).
 */

export const ROLES = ["sender", "receiver"] as const;
export type Role = (typeof ROLES)[number];

export const PAIR_STATUS = ["pending", "active", "revoked"] as const;
export type PairStatus = (typeof PAIR_STATUS)[number];

/** Delivery lifecycle on the backend: received (sent) -> acknowledged (delivered). */
export const DELIVERY_STATUS = ["sent", "delivered"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUS)[number];

/** Local outbox status on the sender device (before the backend confirms). */
export const OUTBOX_STATUS = ["pending", "sent", "delivered", "failed"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUS)[number];

export const PLATFORMS = ["android", "ios", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Hybrid ECIES scheme: ephemeral X25519 + XSalsa20-Poly1305 (NaCl box). */
export const ENCRYPTION_SCHEME = "x25519-xsalsa20-poly1305" as const;
export type EncryptionScheme = typeof ENCRYPTION_SCHEME;

/** V1 signed-envelope scheme (same ECIES box, plus an Ed25519 signature over
 * canonicalized envelope fields). Must stay in lockstep with @simbridge/crypto's
 * CRYPTO_SCHEME so shared contracts and the crypto package never disagree. */
export const ENCRYPTION_SCHEME_V1 = "x25519-xsalsa20-poly1305-v1" as const;
export type EncryptionSchemeV1 = typeof ENCRYPTION_SCHEME_V1;

/**
 * Message envelope protocol versions. V0 is the pre-hardening scheme
 * (unversioned payload, no signature). V1 is the signed, replay-protected
 * envelope (see @simbridge/crypto). Devices advertise the version they speak.
 */
export const MESSAGE_PROTOCOL_V0 = 0 as const;
export const MESSAGE_PROTOCOL_V1 = 1 as const;
export const MESSAGE_PROTOCOL_VERSIONS = [MESSAGE_PROTOCOL_V0, MESSAGE_PROTOCOL_V1] as const;
export type MessageProtocolVersion = (typeof MESSAGE_PROTOCOL_VERSIONS)[number];

/**
 * Device `name` is the device's phone number. Normalization strips common
 * separators (spaces, dashes, parens, dots) so `+1 555 123 4567` and
 * `+15551234567` are treated as the same unique device.
 */
export const normalizePhoneNumber = (value: string): string =>
  value.trim().replace(/[\s().-]/g, "");

/** Accepted formats: optional leading `+`, then 7-15 digits. */
export const PHONE_NUMBER_RE = /^\+?[0-9]{7,15}$/;

export const isValidPhoneNumber = (value: string): boolean =>
  PHONE_NUMBER_RE.test(normalizePhoneNumber(value));

/** Room naming — the backend groups sockets by pair room. */
export const pairRoom = (roomId: string) => `pair:${roomId}`;
export const deviceRoom = (deviceId: string) => `device:${deviceId}`;

/** Error codes returned in the `{ ok: false, error: { code } }` envelope. */
export const ERROR_CODES = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  INVALID_API_KEY: "INVALID_API_KEY",
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PAIR_NOT_FOUND: "PAIR_NOT_FOUND",
  PAIR_CODE_EXPIRED: "PAIR_CODE_EXPIRED",
  PAIR_ALREADY_ACTIVE: "PAIR_ALREADY_ACTIVE",
  RATE_LIMITED: "RATE_LIMITED",
  /** Identity/key hardening errors. */
  DEVICE_KEY_CHANGED: "DEVICE_KEY_CHANGED",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  KEY_POP_REQUIRED: "KEY_POP_REQUIRED",
  CHALLENGE_NOT_FOUND: "CHALLENGE_NOT_FOUND",
  CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED",
  CHALLENGE_REUSED: "CHALLENGE_REUSED",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Response envelope used by every REST endpoint. */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };
