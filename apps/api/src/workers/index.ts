/**
 * Background worker services (image: "Background Worker Services"):
 *  - Process pending messages / retry failed deliveries (sync hints to online receivers)
 *  - Send push notifications for stuck deliveries
 *  - Monitor device health (force-offline stale devices)
 *  - Clean up old data (expired pairing codes; TTL indexes handle messages/audits)
 */
import { Device } from "../db/models/device.js";
import { Pair } from "../db/models/pair.js";
import { Message } from "../db/models/message.js";
import { logger } from "../utils/logger.js";
import { isDeviceOnline } from "../realtime/io.js";
import { deviceRoom, SocketEvents } from "@simbridge/shared";
import { sendPush } from "../services/notifier.js";
import type { SimBridgeServer } from "../realtime/io.js";

const HEALTH_INTERVAL_MS = 30_000;
const RETRY_INTERVAL_MS = 45_000;
const CLEANUP_INTERVAL_MS = 60_000;

export function startWorkers(io: SimBridgeServer): void {
  // 1) Device health watchdog — devices that vanished without a disconnect.
  setInterval(async () => {
    try {
      const stale = await Device.find({
        status: "online",
        lastSeenAt: { $lt: new Date(Date.now() - 5 * 60_000) },
      })
        .select("deviceId role")
        .lean<Array<{ deviceId: string; role: string }>>();
      for (const d of stale) {
        if (isDeviceOnline(d.deviceId)) {
          await Device.updateOne({ deviceId: d.deviceId }, { $set: { lastSeenAt: new Date() } });
          continue;
        }
        await Device.updateOne({ deviceId: d.deviceId }, { $set: { status: "offline" } });
        io.emit(SocketEvents.DEVICE_PRESENCE, { deviceId: d.deviceId, role: d.role as "sender" | "receiver", online: false });
        logger.debug("worker: forced device offline", { deviceId: d.deviceId });
      }
    } catch (err) {
      logger.warn("worker: health check failed", { err: String(err) });
    }
  }, HEALTH_INTERVAL_MS).unref();

  // 2) Delivery retry — nudge online receivers about undelivered messages.
  setInterval(async () => {
    try {
      const stuck = await Message.aggregate<{ _id: { pairId: string; receiverDeviceId: string }; count: number }>([
        { $match: { status: "sent", createdAt: { $lt: new Date(Date.now() - 15_000) } } },
        { $group: { _id: { pairId: "$pairId", receiverDeviceId: "$receiverDeviceId" }, count: { $sum: 1 } } },
        { $limit: 200 },
      ]);
      for (const row of stuck) {
        if (!isDeviceOnline(row._id.receiverDeviceId)) continue;
        io.to(deviceRoom(row._id.receiverDeviceId)).emit(SocketEvents.SYNC_HINT, {
          pairId: row._id.pairId,
          pendingCount: row.count,
        });
      }
    } catch (err) {
      logger.warn("worker: retry sweep failed", { err: String(err) });
    }
  }, RETRY_INTERVAL_MS).unref();

  // 3) Cleanup — expired pending pairs + push nudge for offline receivers.
  setInterval(async () => {
    try {
      const expired = await Pair.deleteMany({
        status: "pending",
        codeExpiresAt: { $lt: new Date() },
      });
      if (expired.deletedCount > 0) {
        logger.debug("worker: purged expired pairing requests", { count: expired.deletedCount });
      }

      // Offline receivers with stuck messages get ONE quiet push (throttled by message age > 2m).
      const offline = await Message.aggregate<{ _id: string; count: number }>([
        { $match: { status: "sent", createdAt: { $lt: new Date(Date.now() - 120_000) } } },
        { $group: { _id: "$receiverDeviceId", count: { $sum: 1 } } },
        { $limit: 50 },
      ]);
      for (const row of offline) {
        if (isDeviceOnline(row._id)) continue;
        const device = await Device.findOne({ deviceId: row._id })
          .select("pushToken")
          .lean<{ pushToken?: string }>();
        if (device?.pushToken) {
          void sendPush({
            deviceId: row._id,
            title: "SIMBridge",
            body: `You have ${row.count} new message${row.count > 1 ? "s" : ""}`,
          });
        }
      }
    } catch (err) {
      logger.warn("worker: cleanup failed", { err: String(err) });
    }
  }, CLEANUP_INTERVAL_MS).unref();

  logger.info("background workers started", {
    health: `${HEALTH_INTERVAL_MS}ms`,
    retry: `${RETRY_INTERVAL_MS}ms`,
    cleanup: `${CLEANUP_INTERVAL_MS}ms`,
  });
}
