import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export async function connectMongo(): Promise<void> {
  mongoose.set("strictQuery", true);
  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("error", (err) => logger.error("MongoDB error", { err: String(err) }));

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    appName: "simbridge-api",
  });
}

export function mongoState(): "connected" | "connecting" | "disconnected" {
  switch (mongoose.connection.readyState) {
    case 1:
      return "connected";
    case 2:
    case 3:
      return "connecting";
    default:
      return "disconnected";
  }
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
