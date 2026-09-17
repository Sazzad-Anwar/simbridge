import { randomInt, randomUUID, randomBytes } from "node:crypto";

/** Short unique id with a domain prefix, e.g. `dev_9f2c1a…`. */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** 6-digit pairing code (temporary, TTL-bound). */
export function newPairingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Device API key — shown once at registration, stored only as a SHA-256 hash. */
export function generateApiKey(): string {
  return `sb_${randomBytes(32).toString("base64url")}`;
}
