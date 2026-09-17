import { Schema, model } from "mongoose";
import type { DeliveryStatus } from "@simbridge/shared";

export interface MessageDoc {
  messageId: string;
  pairId: string;
  roomId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  /** Client-generated id for at-least-once + idempotent delivery. */
  clientMsgId: string;
  seq: number;
  payload: {
    ciphertext: string;
    ephemPublicKey: string;
    nonce: string;
    scheme: string;
  };
  sim?: {
    subscriptionId?: number;
    carrierName?: string;
    slotIndex?: number;
    displayName?: string;
    phoneNumber?: string;
  };
  status: DeliveryStatus;
  deliveredAt?: Date;
  deliveredTo?: string;
  /** TTL — old messages are purged automatically (optional message retention). */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<MessageDoc>(
  {
    messageId: { type: String, required: true, unique: true },
    pairId: { type: String, required: true },
    roomId: { type: String, required: true },
    senderDeviceId: { type: String, required: true },
    receiverDeviceId: { type: String, required: true },
    clientMsgId: { type: String, required: true },
    seq: { type: Number, required: true },
    payload: {
      ciphertext: { type: String, required: true },
      ephemPublicKey: { type: String, required: true },
      nonce: { type: String, required: true },
      scheme: { type: String, required: true },
    },
    sim: {
      subscriptionId: { type: Number },
      carrierName: { type: String },
      slotIndex: { type: Number },
      displayName: { type: String },
      phoneNumber: { type: String },
    },
    status: { type: String, enum: ["sent", "delivered"], default: "sent" },
    deliveredAt: { type: Date },
    deliveredTo: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Idempotency: the same clientMsgId inside a pair can only be stored once.
MessageSchema.index({ pairId: 1, clientMsgId: 1 }, { unique: true });
// Fast sync by sequence number.
MessageSchema.index({ pairId: 1, seq: 1 });
MessageSchema.index({ roomId: 1, seq: 1 });
// Worker lookups for pending delivery.
MessageSchema.index({ receiverDeviceId: 1, status: 1 });
// MongoDB TTL index — documents expire automatically at `expiresAt`.
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Message = model<MessageDoc>("Message", MessageSchema);
