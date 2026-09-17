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
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Response envelope used by every REST endpoint. */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };
