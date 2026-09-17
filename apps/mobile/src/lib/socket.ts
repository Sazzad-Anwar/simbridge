/**
 * Socket.IO client singleton with auto-reconnect + re-authentication.
 * Events are fully typed via @simbridge/shared contracts.
 */
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@simbridge/shared";
import { secrets } from "./storage";
import { getServerUrl } from "./api";

/** Client-side socket: listens to ServerToClientEvents, emits ClientToServerEvents. */
export type SimBridgeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: SimBridgeSocket | null = null;

export function getSocket(): SimBridgeSocket | null {
  return socket;
}

export async function connectSocket(): Promise<SimBridgeSocket> {
  if (socket?.connected) return socket;
  disconnectSocket();

  const token = await secrets.get("token");
  if (!token) throw new Error("No access token — register the device first");

  socket = io(getServerUrl(), {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15_000,
    timeout: 10_000,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/** Typed emit helper with acknowledgement promise. */
export function emitWithAck<T>(fn: (cb: (res: T) => void) => void, timeoutMs = 10_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket ack timeout")), timeoutMs);
    fn((res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}
