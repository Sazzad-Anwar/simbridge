import { Schema, model } from "mongoose";
import { env } from "../../config/env.js";

/**
 * Single-use proof-of-possession challenges.
 * A challenge binds an issue-time (device, purpose), expires quickly, and is
 * consumed exactly once. The raw challenge bytes are cryptographically random.
 */
export interface ChallengeDoc {
  challengeId: string;
  /** Base64 of 32 cryptographically-random bytes — the value devices sign. */
  challenge: string;
  purpose: "register" | "rekey";
  /** Bound to the issuing authenticated device for `rekey`; absent for `register`. */
  deviceId?: string;
  usedAt?: Date;
  createdAt: Date;
  expiresAt: Date;
}

const ChallengeSchema = new Schema<ChallengeDoc>({
  challengeId: { type: String, required: true, unique: true },
  challenge: { type: String, required: true },
  purpose: { type: String, enum: ["register", "rekey"], required: true },
  deviceId: { type: String },
  usedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

// Challenge validity window (short-lived by design).
ChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 });
// Challenge must not be reusable after consumption / by another device.
ChallengeSchema.index({ challengeId: 1, usedAt: 1 });
ChallengeSchema.index({ deviceId: 1, purpose: 1 });

export const Challenge = model<ChallengeDoc>("Challenge", ChallengeSchema);

export const CHALLENGE_TTL_SECONDS = env.challengeTtlSeconds;