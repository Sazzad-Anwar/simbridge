import { Schema, model } from "mongoose";
import type { PairStatus } from "@simbridge/shared";

export interface PairDoc {
  pairId: string;
  /** 6-digit code — present only while the pair is pending. */
  code?: string;
  codeExpiresAt?: Date;
  roomId?: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  status: PairStatus;
  /** Monotonic per-pair message sequence (source of truth for sync). */
  seq: number;
  acceptedAt?: Date;
  revokedAt?: Date;
  /**
   * Sender signing identity pinned when the pair became active. Over time the
   * sender may rotate keys (PATCH /me); the pin is kept in sync on the next
   * verified V1 message and `receiverFingerprintConfirmed` is cleared so the
   * receiver must re-verify before V1 resumes.
   */
  pinnedSenderSignKey?: string;
  pinnedSenderSignKeyFingerprint?: string;
  /** True once each side has explicitly verified the other's fingerprint. */
  senderFingerprintConfirmed: boolean;
  receiverFingerprintConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PairSchema = new Schema<PairDoc>(
  {
    pairId: { type: String, required: true, unique: true },
    code: { type: String },
    codeExpiresAt: { type: Date },
    roomId: { type: String },
    senderDeviceId: { type: String, required: true },
    receiverDeviceId: { type: String, required: true },
    status: { type: String, enum: ["pending", "active", "revoked"], default: "pending" },
    seq: { type: Number, default: 0 },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
    pinnedSenderSignKey: { type: String },
    pinnedSenderSignKeyFingerprint: { type: String },
    senderFingerprintConfirmed: { type: Boolean, default: false },
    receiverFingerprintConfirmed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

PairSchema.index({ senderDeviceId: 1, status: 1 });
PairSchema.index({ receiverDeviceId: 1, status: 1 });
PairSchema.index({ code: 1 }, { sparse: true });
PairSchema.index({ status: 1, codeExpiresAt: 1 });

export const Pair = model<PairDoc>("Pair", PairSchema);
