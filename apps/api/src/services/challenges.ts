import { randomBytes } from "node:crypto";
import { Challenge } from "../db/models/challenge.js";
import { newId } from "../utils/ids.js";
import { env } from "../config/env.js";
import { errors } from "../utils/errors.js";

export interface IssuedChallenge {
  challengeId: string;
  /** Base64 challenge bytes — the client signs these with its Ed25519 key. */
  challenge: string;
  purpose: "register" | "rekey";
  expiresAt: string;
}

/** Issue a fresh, single-use, TTL-bound cryptographic challenge. */
export async function issueChallenge(input: {
  purpose: "register" | "rekey";
  deviceId?: string;
}): Promise<IssuedChallenge> {
  const challenge = randomBytes(32).toString("base64");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + env.challengeTtlSeconds * 1000);
  const challengeId = newId("chk");
  await Challenge.create({
    challengeId,
    challenge,
    purpose: input.purpose,
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    createdAt,
    expiresAt,
  });
  return {
    challengeId,
    challenge,
    purpose: input.purpose,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Atomically consume (single-use) a challenge. Marks it used in the same
 * conditional update that requires it to be unused, unexpired, on-purpose and
 * bound to the requesting device where applicable.
 */
export async function consumeChallenge(input: {
  challengeId: string;
  purpose: "register" | "rekey";
  deviceId?: string;
}): Promise<string> {
  const filter: Record<string, unknown> = {
    challengeId: input.challengeId,
    purpose: input.purpose,
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  };
  if (input.deviceId !== undefined) {
    filter.deviceId = input.deviceId;
  }

  const consumed = await Challenge.findOneAndUpdate(
    filter,
    { $set: { usedAt: new Date() } },
    { new: true },
  )
    .select({ challenge: 1, _id: 0 })
    .lean<{ challenge: string } | null>();

  if (consumed) return consumed.challenge;

  // Distinguish why consumption failed (all while the TTL cleanup may lag).
  const existing = await Challenge.findOne({ challengeId: input.challengeId })
    .select({ challenge: 1, purpose: 1, deviceId: 1, usedAt: 1, expiresAt: 1 })
    .lean();
  if (!existing) throw errors.challengeNotFound();
  if (existing.usedAt) throw errors.challengeReused();
  if (existing.expiresAt.getTime() < Date.now()) throw errors.challengeExpired();
  if (existing.purpose !== input.purpose) throw errors.challengeNotFound();
  if (input.deviceId !== undefined && existing.deviceId !== undefined && existing.deviceId !== input.deviceId) {
    throw errors.forbidden("Challenge was issued for a different device");
  }
  // Conservative fallback — a challenge that cannot be safely consumed is unusable.
  throw errors.challengeNotFound();
}