import type { Server as SocketIOServer, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@simbridge/shared";

export type SimBridgeServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type SimBridgeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let io: SimBridgeServer | null = null;

export function setIo(server: SimBridgeServer): void {
  io = server;
}

export function getIo(): SimBridgeServer {
  if (!io) throw new Error("Socket.IO server not initialized yet");
  return io;
}

export function tryGetIo(): SimBridgeServer | null {
  return io;
}

// ---- Presence tracking (in-memory; Redis adapter covers multi-instance) ----
const connectedDevices = new Map<string, number>();

/** Returns true if this socket is the first connection for the device. */
export function presenceConnect(deviceId: string): boolean {
  const next = (connectedDevices.get(deviceId) ?? 0) + 1;
  connectedDevices.set(deviceId, next);
  return next === 1;
}

/** Returns true if the device has no sockets left (i.e. it went offline). */
export function presenceDisconnect(deviceId: string): boolean {
  const next = (connectedDevices.get(deviceId) ?? 0) - 1;
  if (next <= 0) {
    connectedDevices.delete(deviceId);
    return true;
  }
  connectedDevices.set(deviceId, next);
  return false;
}

export const isDeviceOnline = (deviceId: string): boolean => connectedDevices.has(deviceId);

export const onlineDeviceIds = (): string[] => [...connectedDevices.keys()];

export const onlineDeviceCount = (): number => connectedDevices.size;
