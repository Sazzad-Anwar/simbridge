import { Device } from "../db/models/device.js";
import { Pair } from "../db/models/pair.js";
import { Message } from "../db/models/message.js";
import { audit } from "../db/models/audit.js";
import { verifyAccessToken } from "../auth/tokens.js";
import { logger } from "../utils/logger.js";
import { sendMessage, acknowledgeMessages, syncMessages } from "../services/messages.js";
import { presenceConnect, presenceDisconnect } from "./io.js";
import { emitDevicePresence } from "./presence.js";
import type { SimBridgeServer, SimBridgeSocket } from "./io.js";
import {
  deviceRoom,
  pairRoom,
  ERROR_CODES,
  SocketEvents,
} from "@simbridge/shared";
import type { SocketAckError } from "@simbridge/shared";

function ackError(err: unknown): SocketAckError {
  if (err && typeof err === "object" && "code" in err && "status" in err) {
    const apiErr = err as unknown as { code: string; message: string };
    return { code: apiErr.code, message: apiErr.message };
  }
  return { code: ERROR_CODES.INTERNAL, message: "Internal server error" };
}

async function activePairsFor(deviceId: string) {
  return Pair.find({
    status: "active",
    $or: [{ senderDeviceId: deviceId }, { receiverDeviceId: deviceId }],
  }).lean<Array<{ pairId: string; roomId: string; senderDeviceId: string; receiverDeviceId: string }>>();
}

/** Socket.IO server wiring: JWT handshake auth, rooms, presence, message fan-out. */
export function setupRealtime(io: SimBridgeServer): void {
  // --- Handshake authentication (JWT from `auth.token` or Authorization header) ---
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.startsWith("Bearer ")
          ? socket.handshake.headers.authorization.slice(7).trim()
          : undefined);
      if (!token) return next(new Error(ERROR_CODES.AUTH_REQUIRED));
      const payload = await verifyAccessToken(token);
      const device = await Device.findOne({ deviceId: payload.deviceId }).lean();
      if (!device) return next(new Error(ERROR_CODES.DEVICE_NOT_FOUND));
      socket.data.deviceId = device.deviceId;
      socket.data.role = device.role;
      socket.data.deviceName = device.name;
      next();
    } catch {
      next(new Error(ERROR_CODES.INVALID_TOKEN));
    }
  });

  io.on("connection", async (socket: SimBridgeSocket) => {
    const { deviceId, role } = socket.data;
    logger.debug("socket connected", { deviceId, socketId: socket.id });

    const firstConnection = presenceConnect(deviceId);
    if (firstConnection) {
      await Device.updateOne(
        { deviceId },
        { $set: { status: "online", lastSeenAt: new Date() } },
      );
    }
    socket.join(deviceRoom(deviceId));

    try {
      // Auto-join all active pair rooms for this device.
      const pairs = await activePairsFor(deviceId);
      for (const p of pairs) socket.join(pairRoom(p.roomId));

      // Presence broadcast — scoped to the devices this one is paired with.
      void emitDevicePresence(deviceId, role, true, new Date().toISOString());

      // Fetch-missed-messages hint (step 7 of the flow).
      for (const p of pairs) {
        const filter =
          role === "receiver"
            ? { pairId: p.pairId, receiverDeviceId: deviceId, status: "sent" }
            : { pairId: p.pairId, senderDeviceId: deviceId, status: "sent" };
        const pending = await Message.countDocuments(filter);
        if (pending > 0) {
          socket.emit(SocketEvents.SYNC_HINT, { pairId: p.pairId, pendingCount: pending });
        }
      }
      audit("device.online", { deviceId });
    } catch (err) {
      logger.error("connection setup failed", { deviceId, err: String(err) });
    }

    // ---- Client -> Server handlers ----
    socket.on(SocketEvents.PAIR_JOIN, ({ roomId }, cb) => {
      (async () => {
        const pair = await Pair.findOne({ roomId, status: "active" }).lean();
        if (
          !pair ||
          (pair.senderDeviceId !== deviceId && pair.receiverDeviceId !== deviceId)
        ) {
          cb?.({ ok: false, error: { code: ERROR_CODES.FORBIDDEN, message: "Room not available for this device" } });
          return;
        }
        socket.join(pairRoom(roomId));
        cb?.({ ok: true });
      })().catch(() => cb?.({ ok: false, error: ackError(null) }));
    });

    socket.on(SocketEvents.MESSAGE_NEW, (input, cb) => {
      sendMessage({ deviceId, role }, input)
        .then((data) => cb?.({ ok: true, data }))
        .catch((err) => cb?.({ ok: false, error: ackError(err) }));
    });

    socket.on(SocketEvents.MESSAGE_ACK, (input, cb) => {
      acknowledgeMessages({ deviceId }, input)
        .then((data) => cb?.({ ok: true, data }))
        .catch((err) => cb?.({ ok: false, error: ackError(err) }));
    });

    socket.on(SocketEvents.SYNC_FETCH, (input, cb) => {
      syncMessages({ deviceId }, input)
        .then((data) => cb?.({ ok: true, data }))
        .catch((err) => cb?.({ ok: false, error: ackError(err) }));
    });

    socket.on("disconnect", async () => {
      const wentOffline = presenceDisconnect(deviceId);
      if (wentOffline) {
        await Device.updateOne(
          { deviceId },
          { $set: { status: "offline", lastSeenAt: new Date() } },
        ).catch(() => undefined);
        void emitDevicePresence(deviceId, role, false, new Date().toISOString());
        audit("device.offline", { deviceId });
        logger.debug("device went offline", { deviceId });
      }
    });
  });

  io.engine.on("connection_error", (err) => {
    logger.warn("socket handshake rejected", { reason: err.message ?? String(err) });
  });
}
