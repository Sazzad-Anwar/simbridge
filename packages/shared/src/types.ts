import type {
  DeliveryStatus,
  EncryptionScheme,
  EncryptionSchemeV1,
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

/** Identity key snapshot exposed on a pair for fingerprint confirmation. */
export interface PairIdentity {
  /** X25519 public key (existing pairing key). */
  publicKey: string;
  /** Ed25519 signing public key (V1). Absent on legacy V0 devices. */
  signingPublicKey?: string;
  /** Fingerprint = hash(encPublicKey ‖ signPublicKey); what users compare. */
  signingKeyFingerprint?: string;
}

export interface DeviceDTO {
  deviceId: string;
  name: string;
  platform: Platform;
  role: Role;
  publicKey: string;
  /** Base64 Ed25519 signing public key (V1 hardening). Absent on legacy V0 devices. */
  signingPublicKey?: string;
  signingKeyFingerprint?: string;
  /** Message protocol version the device communicates at (0 = legacy V0, 1 = V1). */
  protocolVersion: 0 | 1;
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
  /** Canonical role — on a reclaim this may differ from the requested role. */
  role: Role;
}

export interface TokenResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

/** A single-use proof-of-possession challenge issued by POST /auth/challenge. */
export interface ChallengeToken {
  challengeId: string;
  /** Base64-encoded challenge bytes; devices sign them with their Ed25519 key. */
  challenge: string;
  purpose: "register" | "rekey";
  expiresAt: string;
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
  /** V1 identity snapshots (present on hardened devices). */
  senderSigningPublicKey?: string;
  senderSigningKeyFingerprint?: string;
  receiverSigningPublicKey?: string;
  receiverSigningKeyFingerprint?: string;
  /**
   * Message protocol this pair communicates at: 1 when BOTH devices are
   * hardened (V1), 0 when either side still speaks legacy V0.
   */
  protocolVersion: 0 | 1;
  /**
   * Whether each side has explicitly verified the OTHER side's fingerprint.
   * V1 messaging is only enabled when both are true.
   */
  senderFingerprintConfirmed: boolean;
  receiverFingerprintConfirmed: boolean;
  /** Only present while the pair is pending (sender side). */
  code?: string;
  codeExpiresAt?: string;
  roomId?: string;
  createdAt: string;
  acceptedAt?: string;
  /**
   * Live presence of the OTHER device in this pair (the peer), from this
   * device's perspective. Updated in real time via `device:presence` and
   * refreshed as a snapshot on every pair fetch.
   */
  peerStatus?: "online" | "offline";
  peerLastSeenAt?: string;
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
  senderSigningPublicKey?: string;
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

/**
 * V1 signed envelope payload. Must match @simbridge/crypto's envelope exactly:
 * every field below is part of the canonicalized, Ed25519-signed content.
 */
export interface EnvelopePayloadV1 {
  version: 1;
  scheme: EncryptionSchemeV1;
  /** Globally-unique id, chosen by the sender and covered by the signature. */
  messageId: string;
  pairId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  senderSignKeyFingerprint: string;
  ephemPublicKey: string;
  nonce: string;
  ciphertext: string;
  createdAt: string;
  signature: string;
}

/** What the backend relays: either the legacy V0 payload or a signed V1 envelope. */
export type MessagePayload = EncryptedPayload | EnvelopePayloadV1;

export interface MessageDTO {
  messageId: string;
  pairId: string;
  roomId: string;
  senderDeviceId: string;
  clientMsgId: string;
  seq: number;
  /** Originating SMS sender phone number (relayed as-is, still only ever handled as metadata). */
  from?: string;
  /** Contact name for the originating SMS sender, resolved on the SIM phone. */
  fromName?: string;
  payload: MessagePayload;
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
  payload: MessagePayload;
  sim?: MessageDTO["sim"];
  from?: string;
  fromName?: string;
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

export interface ExistsInput {
  pairId: string;
  clientMsgIds: string[];
}

export interface ExistsResult {
  existing: string[];
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
