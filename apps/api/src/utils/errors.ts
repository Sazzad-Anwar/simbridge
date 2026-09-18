import { ERROR_CODES } from "@simbridge/shared";
import type { ErrorCode } from "@simbridge/shared";

/** Typed API error -> mapped to `{ ok: false, error: { code, message } }`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const errors = {
  authRequired: () =>
    new ApiError(401, ERROR_CODES.AUTH_REQUIRED, "Authorization header required (Bearer token)"),
  invalidToken: (msg = "Invalid or expired access token") =>
    new ApiError(401, ERROR_CODES.INVALID_TOKEN, msg),
  invalidApiKey: (msg = "Invalid deviceId or apiKey") =>
    new ApiError(401, ERROR_CODES.INVALID_API_KEY, msg),
  deviceNotFound: () => new ApiError(404, ERROR_CODES.DEVICE_NOT_FOUND, "Device not found"),
  forbidden: (msg = "You are not allowed to perform this action") =>
    new ApiError(403, ERROR_CODES.FORBIDDEN, msg),
  notFound: (msg = "Resource not found") => new ApiError(404, ERROR_CODES.NOT_FOUND, msg),
  validation: (msg = "Request validation failed") =>
    new ApiError(422, ERROR_CODES.VALIDATION_ERROR, msg),
  pairNotFound: () => new ApiError(404, ERROR_CODES.PAIR_NOT_FOUND, "Pair not found"),
  pairCodeExpired: () =>
    new ApiError(410, ERROR_CODES.PAIR_CODE_EXPIRED, "Pairing code is invalid or expired"),
  pairAlreadyActive: () =>
    new ApiError(409, ERROR_CODES.PAIR_ALREADY_ACTIVE, "These devices are already paired"),
  duplicate: (msg = "A device with this phone number is already registered") =>
    new ApiError(409, ERROR_CODES.VALIDATION_ERROR, msg),
  rateLimited: (retryAfterSeconds: number) =>
    new ApiError(429, ERROR_CODES.RATE_LIMITED, `Too many requests. Retry in ${retryAfterSeconds}s`, {
      retryAfterSeconds,
    }),
  internal: (msg = "Internal server error") => new ApiError(500, ERROR_CODES.INTERNAL, msg),
};
