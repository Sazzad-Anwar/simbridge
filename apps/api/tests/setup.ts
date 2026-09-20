/**
 * Test bootstrap. Runs once before all suites import any app code.
 *
 * Points the API at an isolated MongoDB database and probes connectivity so
 * suites can skip cleanly when no local Mongo is running.
 */

// Env must be set before the `env` singleton is first imported.
process.env.MONGO_URI = process.env.MONGO_URI_TEST || "mongodb://127.0.0.1:27017/simbridge_test";
process.env.ACCESS_KEY = "test";
process.env.RATE_LIMIT_WINDOW_MS = "60000";

import { beforeAll, afterAll } from "vitest";
import net from "node:net";

async function probe(uri: string, timeoutMs = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    const url = new URL(uri);
    const port = Number(url.port || 27017);
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    const socket = net.connect({ host: url.hostname, port });
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

export const hasMongo = (await probe(process.env.MONGO_URI)) as boolean;

if (hasMongo) {
  beforeAll(async () => {
    const mongoose = (await import("mongoose")).default;
    await mongoose.connect(process.env.MONGO_URI!, {
      serverSelectionTimeoutMS: 5000,
    });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
}