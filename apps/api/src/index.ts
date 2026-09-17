/**
 * SIMBridge API bootstrap.
 *
 * One Node process, one port:
 *   - Elysia.js handles REST (mounted via the fetch-style node adapter)
 *   - Socket.IO handles real-time messaging on the same HTTP server
 *   - MongoDB (local) persists devices, pairs, encrypted messages, audit logs
 */
import { Server as SocketIOServer } from "socket.io";
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "@simbridge/shared";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { connectMongo, disconnectMongo } from "./db/mongo.js";
import { createApp } from "./app.js";
import { createHttpServer } from "./http/node-adapter.js";
import { setIo } from "./realtime/io.js";
import type { SimBridgeServer } from "./realtime/io.js";
import { setupRealtime } from "./realtime/socket.js";
import { startWorkers } from "./workers/index.js";

async function maybeAttachRedisAdapter(io: SimBridgeServer): Promise<void> {
  if (!env.redisUrl) return;
  try {
    const [{ createAdapter }, redisModule] = await Promise.all([
      import("@socket.io/redis-adapter"),
      import("ioredis"),
    ]);
    const RedisCtor = redisModule.default as unknown as new (url: string) => import("ioredis").Redis;
    const pub = new RedisCtor(env.redisUrl);
    const sub = new RedisCtor(env.redisUrl);
    io.adapter(createAdapter(pub, sub));
    logger.info("Socket.IO Redis adapter enabled (multi-instance ready)");
  } catch (err) {
    logger.warn("Redis adapter unavailable; running single-instance", { err: String(err) });
  }
}

async function main(): Promise<void> {
  logger.info("SIMBridge API starting…", { version: env.version, node: process.version });
  await connectMongo();

  const app = createApp();
  const httpServer = createHttpServer(app);

  const io: SimBridgeServer = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(","),
      methods: ["GET", "POST"],
    },
    connectionStateRecovery: { maxDisconnectionDuration: 120_000 },
    pingInterval: 20_000,
    pingTimeout: 25_000,
  });

  await maybeAttachRedisAdapter(io);
  setIo(io);
  setupRealtime(io);
  startWorkers(io);

  httpServer.listen(env.port, env.host, () => {
    logger.info(`SIMBridge API listening on http://${env.host}:${env.port}`, {
      statusPage: `http://localhost:${env.port}/`,
      swagger: `http://localhost:${env.port}/docs`,
      mongo: env.mongoUri,
    });
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully…`);
    try {
      const { tryGetIo } = await import("./realtime/io.js");
      tryGetIo()?.close();
      httpServer.close();
      await disconnectMongo();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("fatal startup error", { err: err instanceof Error ? err.stack : String(err) });
  process.exit(1);
});
