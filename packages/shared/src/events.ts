import type {
  AckInput,
  AckResult,
  DeviceDTO,
  MessageDTO,
  PairDTO,
  SendMessageInput,
  SendMessageResult,
  SyncResult,
} from "./types";

/**
 * Socket.IO event contracts shared by the backend and both apps.
 * Namespaces: `pair:*`, `message:*`, `pairing:*`, `device:*`, `sync:*`.
 */
export const SocketEvents = {
  // ---- client -> server (all with acknowledgement callbacks) ----
  /** Join the room of an active pair (done automatically on connect too). */
  PAIR_JOIN: "pair:join",
  /** Emit a new encrypted message into the pair room. */
  MESSAGE_NEW: "message:new",
  /** Receiver acknowledges delivery of one or more messages. */
  MESSAGE_ACK: "message:ack",
  /** Fetch missed messages (used on app start / reconnect). */
  SYNC_FETCH: "sync:fetch",

  // ---- server -> client ----
  /** Receiver: a sender wants to pair (or a push notification covers this). */
  PAIRING_INCOMING: "pairing:incoming",
  /** Sender: the receiver accepted the pairing request. */
  PAIRING_ACCEPTED: "pairing:accepted",
  /** Either side: a pair was revoked. */
  PAIR_REVOKED: "pair:revoked",
  /** Receiver: a new encrypted message arrived in real time. */
  MESSAGE_INCOMING: "message:incoming",
  /** Sender: the receiver acknowledged a message. */
  MESSAGE_DELIVERED: "message:delivered",
  /** Presence changes for a device (online/offline). */
  DEVICE_PRESENCE: "device:presence",
  /** Hint that undelivered messages are waiting — client should call sync. */
  SYNC_HINT: "sync:hint",
} as const;

export interface SocketAckError {
  code: string;
  message: string;
}

export interface ClientToServerEvents {
  [SocketEvents.PAIR_JOIN]: (
    input: { roomId: string },
    cb: (res: { ok: true } | { ok: false; error: SocketAckError }) => void,
  ) => void;

  [SocketEvents.MESSAGE_NEW]: (
    input: SendMessageInput,
    cb: (res: { ok: true; data: SendMessageResult } | { ok: false; error: SocketAckError }) => void,
  ) => void;

  [SocketEvents.MESSAGE_ACK]: (
    input: AckInput,
    cb: (res: { ok: true; data: AckResult } | { ok: false; error: SocketAckError }) => void,
  ) => void;

  [SocketEvents.SYNC_FETCH]: (
    input: { pairId: string; afterSeq: number; limit?: number },
    cb: (res: { ok: true; data: SyncResult } | { ok: false; error: SocketAckError }) => void,
  ) => void;
}

export interface ServerToClientEvents {
  [SocketEvents.PAIRING_INCOMING]: (payload: {
    pairId: string;
    code: string;
    senderDeviceId: string;
    senderName: string;
    expiresAt: string;
  }) => void;

  [SocketEvents.PAIRING_ACCEPTED]: (payload: {
    pairId: string;
    roomId: string;
    receiverDeviceId: string;
    receiverName: string;
  }) => void;

  [SocketEvents.PAIR_REVOKED]: (payload: { pairId: string; roomId?: string }) => void;

  [SocketEvents.MESSAGE_INCOMING]: (payload: MessageDTO) => void;

  [SocketEvents.MESSAGE_DELIVERED]: (payload: {
    messageId: string;
    pairId: string;
    deliveredAt: string;
    byDeviceId: string;
  }) => void;

  [SocketEvents.DEVICE_PRESENCE]: (payload: {
    deviceId: string;
    role: DeviceDTO["role"];
    online: boolean;
  }) => void;

  [SocketEvents.SYNC_HINT]: (payload: { pairId: string; pendingCount?: number }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  deviceId: string;
  role: DeviceDTO["role"];
  deviceName: string;
}
