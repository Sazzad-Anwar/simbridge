import { Schema, model } from "mongoose";

export interface SimDoc {
  deviceId: string;
  subscriptionId: number;
  carrierName: string;
  slotIndex: number;
  displayName: string;
  phoneNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SimSchema = new Schema<SimDoc>(
  {
    deviceId: { type: String, required: true },
    subscriptionId: { type: Number, required: true },
    carrierName: { type: String, default: "" },
    slotIndex: { type: Number, default: 0 },
    displayName: { type: String, default: "" },
    phoneNumber: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

SimSchema.index({ deviceId: 1, subscriptionId: 1 }, { unique: true });
SimSchema.index({ phoneNumber: 1 }, { sparse: true });

export const SimSubscription = model<SimDoc>("SimSubscription", SimSchema);
