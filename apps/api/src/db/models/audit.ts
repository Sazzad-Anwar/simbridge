import { Schema, model } from "mongoose";
import type { Types } from "mongoose";
import { env } from "../../config/env.js";

export interface AuditDoc {
  action: string;
  deviceId?: string;
  pairId?: string;
  ip?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const AuditSchema = new Schema<AuditDoc>({
  action: { type: String, required: true },
  deviceId: { type: String },
  pairId: { type: String },
  ip: { type: String },
  meta: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

// TTL — audit trail retention.
AuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: env.auditTtlDays * 86_400 });

export const AuditLog = model<AuditDoc>("AuditLog", AuditSchema);

/** Fire-and-forget audit trail writer. */
export function audit(
  action: string,
  data: { deviceId?: string; pairId?: string; ip?: string; meta?: Record<string, unknown> } = {},
): void {
  AuditLog.create({ action, ...data, createdAt: new Date() }).catch(() => {
    /* auditing must never break the request path */
  });
}

export type AuditId = Types.ObjectId;
