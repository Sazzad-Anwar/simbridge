import type {
  DeliveryStatus,
  EncryptionScheme,
  PairStatus,
  Platform,
  Role,
} from "./constants";

/** A SIM (subscription) registered by a sender device. */
export interface SimInfo {
  subscriptionId: number;
  carrierName: string;
  slotIndex: number;
  displayName: string;
  phoneNumber?: string;
  isActive?: boolean;
}

export interface DeviceDTO {
  deviceId: string;
  name: string;
  platform: Platform;
  role: Role;
  publicKey: string;
  sims: SimInfo[];
  status: "online" | "offline";
  lastSeenAt: string;
  createdAt: string;
}

/** Public result of POST /auth/register — apiKey is shown exactly once. */
export interface RegisterResult {
  deviceId: string;
  apiKey: string;
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface TokenResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface PairDTO {
  pairId: string;
  status: PairStatus;
  senderDeviceId: string;
  receiverDeviceId: string;
  senderName?: string;
  receiverName?: string;
  /** Identity public keys — the sender encrypts with receiverPublicKey. */
  senderPublicKey?: string;
  receiverPublicKey?: string;
  /** Only present while the pair is pending (sender side). */
  code?: string;
  codeExpiresAt?: string;
  roomId?: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface CreatePairResult extends PairDTO {
  receiverOnline: boolean;
}

export interface AcceptPairResult {
  pairId: string;
  roomId: string;
  senderDeviceId: string;
  senderName: string;
  senderPublicKey: string;
}

/**
 * End-to-end encrypted payload. The backend stores and relays this blob
 * opaquely — it never sees plaintext messages.
 */
export interface EncryptedPayload {
  ciphertext: string;
  ephemPublicKey: string;
  nonce: string;
  scheme: EncryptionScheme;
}

export interface MessageDTO {
  messageId: string;
  pairId: string;
  roomId: string;
  senderDeviceId: string;
  clientMsgId: string;
  seq: number;
  payload: EncryptedPayload;
  sim?: {
    subscriptionId: number;
    carrierName?: string;
    slotIndex?: number;
    displayName?: string;
    phoneNumber?: string;
  };
  status: DeliveryStatus;
  createdAt: string;
  deliveredAt?: string;
}

export interface SendMessageInput {
  pairId: string;
  clientMsgId: string;
  payload: EncryptedPayload;
  sim?: MessageDTO["sim"];
}

export interface SendMessageResult {
  messageId: string;
  pairId: string;
  seq: number;
  status: DeliveryStatus;
  /** true when a message with the same clientMsgId already existed (idempotent retry). */
  deduplicated: boolean;
}

export interface SyncResult {
  messages: MessageDTO[];
  hasMore: boolean;
  lastSeq: number;
}

export interface AckInput {
  messageIds: string[];
}

export interface AckResult {
  updated: number;
}

export interface StatsResult {
  devices: number;
  pairs: number;
  activePairs: number;
  messages: number;
  messagesDelivered: number;
  onlineDevices: number;
  uptimeSeconds: number;
  mongo: "connected" | "disconnected" | "connecting";
  version: string;
}
