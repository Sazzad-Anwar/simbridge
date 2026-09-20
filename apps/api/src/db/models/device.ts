import mongoose, { Schema, model } from "mongoose";
import type { MessageProtocolVersion, Platform, Role } from "@simbridge/shared";

export interface DeviceDoc {
  deviceId: string;
  apiKeyHash: string;
  name: string;
  platform: Platform;
  role: Role;
  /** Base64 X25519 identity public key — used by senders to encrypt messages. */
  publicKey: string;
  /** Base64 Ed25519 signing public key (V1). Absent on legacy V0 devices. */
  signingPublicKey?: string;
  /** Identity fingerprint = hash(encPublicKey ‖ signingPublicKey). */
  signingKeyFingerprint?: string;
  /** Device message protocol version: 0 (legacy V0) or 1 (signed V1). */
  protocolVersion: MessageProtocolVersion;
  /** When key possession was last proven via a challenge. */
  keysProvenAt?: Date;
  pushToken?: string;
  status: "online" | "offline";
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<DeviceDoc>(
  {
    deviceId: { type: String, required: true, unique: true },
    apiKeyHash: { type: String, required: true },
    name: { type: String, required: true },
    platform: { type: String, enum: ["android", "ios", "other"], default: "android" },
    role: { type: String, enum: ["sender", "receiver"], required: true },
    publicKey: { type: String, required: true },
    signingPublicKey: { type: String },
    signingKeyFingerprint: { type: String },
    protocolVersion: { type: Number, enum: [0, 1], default: 0 },
    keysProvenAt: { type: Date },
    pushToken: { type: String },
    status: { type: String, enum: ["online", "offline"], default: "offline" },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

DeviceSchema.index({ role: 1, status: 1 });

// The device name IS the device's phone number — enforce uniqueness so a
// phone number cannot be registered twice.
DeviceSchema.index({ name: 1 }, { unique: true });

// V1 signature verification is the fast path for message ingestion.
DeviceSchema.index({ signingPublicKey: 1 }, { sparse: true });

export const Device = model<DeviceDoc>("Device", DeviceSchema);
