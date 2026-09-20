/**
 * Peer-scoped presence notifications. When a device's online/offline state
 * changes (socket first connect, last socket disconnect, or the health
 * watchdog force-flip), only the devices it shares an ACTIVE pair with are
 * notified — presence is never broadcast globally.
 */
import { Pair } from "../db/models/pair.js";
import { deviceRoom, SocketEvents } from "@simbridge/shared";
import type { Role } from "@simbridge/shared";
import { tryGetIo } from "./io.js";

async function pairedPeerIds(deviceId: string): Promise<string[]> {
  const pairs = await Pair.find({
    status: "active",
    $or: [{ senderDeviceId: deviceId }, { receiverDeviceId: deviceId }],
  })
    .select("senderDeviceId receiverDeviceId")
    .lean<Array<{ senderDeviceId: string; receiverDeviceId: string }>>();
  return pairs.map((p) =>
    p.senderDeviceId === deviceId ? p.receiverDeviceId : p.senderDeviceId,
  );
}

export async function emitDevicePresence(
  deviceId: string,
  role: Role,
  online: boolean,
  lastSeenAt?: string,
): Promise<void> {
  const io = tryGetIo();
  if (!io) return;
  const peers = await pairedPeerIds(deviceId).catch(() => []);
  if (peers.length === 0) return;
  const payload = {
    deviceId,
    role,
    online,
    lastSeenAt: lastSeenAt ?? new Date().toISOString(),
  };
  for (const peerId of peers) {
    io.to(deviceRoom(peerId)).emit(SocketEvents.DEVICE_PRESENCE, payload);
  }
}