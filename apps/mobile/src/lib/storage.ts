/**
 * Local persistence layer.
 *  - Keystore-grade secrets (identity keys, vault key, apiKey, token) -> expo-secure-store
 *  - Sensitive state (outbox with plaintext SMS bodies, message cache) -> AsyncStorage,
 *    sealed with the device-local vault key (secretbox) so data is encrypted at rest.
 *  - Non-sensitive state (settings, cursors, routing, watermark) -> plain AsyncStorage.
 *
 * Vault semantics (enforced in Phase 4):
 *  - A missing vault key is NEVER silently regenerated and sealed data is NEVER
 *    deleted — callers must surface VAULT_KEY_MISSING and keep the data for recovery.
 *  - Pre-vault plaintext collections are still readable (migration) and are
 *    re-sealed on the next write.
 *  - Unrecoverable sealed data throws LOCAL_STORAGE_RECOVERY_REQUIRED; the blob
 *    is preserved untouched.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  bytesToUtf8,
  decryptLocal,
  encryptLocal,
  localStorageRecoveryRequiredError,
  utf8ToBytes,
  vaultKeyMissingError,
} from "@simbridge/crypto";

const SECURE_KEYS = {
  secretKey: "simbridge.identity.secretKey",
  publicKey: "simbridge.identity.publicKey",
  signSecretKey: "simbridge.identity.signSecretKey",
  signPublicKey: "simbridge.identity.signPublicKey",
  signPublicKeyFingerprint: "simbridge.identity.signPublicKeyFingerprint",
  vaultKey: "simbridge.identity.vaultKey",
  apiKey: "simbridge.identity.apiKey",
  deviceId: "simbridge.identity.deviceId",
  token: "simbridge.identity.token",
} as const;

const STORE_KEYS = {
  serverUrl: "simbridge.serverUrl.v1",
  profile: "simbridge.profile.v1", // { name, role }
  outbox: "simbridge.outbox.v1", // vault-sealed OutboxEntry[] (plaintext SMS bodies at rest)
  messages: "simbridge.messages.v1", // vault-sealed MessageDTO[] cache (receiver inbox)
  lastSeq: "simbridge.lastSeq.v1", // Record<pairId, number>
  routing: "simbridge.routing.v1", // Record<receiverNumber, subscriptionId>
  smsWatermark: "simbridge.smsWatermark.v1", // last processed inbox-scan timestamp
} as const;

export interface StoredProfile {
  name: string;
  role: "sender" | "receiver";
}

export interface OutboxEntry {
  clientMsgId: string;
  pairId: string;
  receiverNumber: string;
  /** Contact name of the originating SMS sender (best-effort; optional). */
  fromName?: string;
  smsBody: string; // plaintext kept ONLY in device-local encrypted storage
  /**
   * The ready-to-send payload. Present for V1 signed envelopes (prepared once
   * at enqueue so the signature + ciphertext survive retries). Legacy V0
   * entries leave this empty and re-encrypt from `smsBody` on each try.
   */
  payload?: import("@simbridge/shared").MessagePayload;
  sim: { subscriptionId: number; carrierName?: string; slotIndex?: number; displayName?: string };
  status: "pending" | "sent" | "delivered" | "failed";
  attempts: number;
  createdAt: number;
  sentAt?: number;
  messageId?: string;
  error?: string;
}

// ---- Secure (Keystore) ----
export const secrets = {
  async get(key: keyof typeof SECURE_KEYS): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SECURE_KEYS[key]);
    } catch {
      return null;
    }
  },
  async set(key: keyof typeof SECURE_KEYS, value: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_KEYS[key], value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async clear(): Promise<void> {
    await Promise.all(
      Object.values(SECURE_KEYS).map((k) =>
        SecureStore.deleteItemAsync(k).catch(() => undefined),
      ),
    );
  },
};

// ---- Regular JSON storage ---- (non-sensitive: settings, cursors, routing)
async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function setJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ---- At-rest vault storage ---- (sensitive: outbox + message cache)

/**
 * Prefix distinguishing vault-sealed blobs from pre-vault (legacy) plaintext.
 * Sealed shape: `sbv1:` + base64( nonce ‖ secretbox(utf8(JSON)) ).
 */
const VAULT_PREF_PREFIX = "sbv1:";

async function readVaulted<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;

  if (!raw.startsWith(VAULT_PREF_PREFIX)) {
    // Legacy pre-vault plaintext: readable now so existing data keeps working;
    // the next write migrates it to the sealed format.
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw localStorageRecoveryRequiredError();
    }
  }

  const vaultKey = await secrets.get("vaultKey");
  if (!vaultKey) throw vaultKeyMissingError();

  let bytes: Uint8Array;
  try {
    bytes = decryptLocal(vaultKey, raw.slice(VAULT_PREF_PREFIX.length));
  } catch {
    // Key present but the blob will not decrypt — preserve it for recovery.
    throw localStorageRecoveryRequiredError();
  }
  try {
    return JSON.parse(bytesToUtf8(bytes)) as T;
  } catch {
    throw localStorageRecoveryRequiredError();
  }
}

async function writeVaulted<T>(key: string, value: T): Promise<void> {
  const vaultKey = await secrets.get("vaultKey");
  if (!vaultKey) throw vaultKeyMissingError();
  const sealed =
    VAULT_PREF_PREFIX + encryptLocal(vaultKey, utf8ToBytes(JSON.stringify(value)));
  await AsyncStorage.setItem(key, sealed);
}

export const storage = {
  getServerUrl: () => AsyncStorage.getItem(STORE_KEYS.serverUrl),
  setServerUrl: (url: string) => AsyncStorage.setItem(STORE_KEYS.serverUrl, url),
  getProfile: () => getJSON<StoredProfile | null>(STORE_KEYS.profile, null),
  setProfile: (p: StoredProfile) => setJSON(STORE_KEYS.profile, p),

  getOutbox: () => readVaulted<OutboxEntry[]>(STORE_KEYS.outbox, []),
  setOutbox: (entries: OutboxEntry[]) => writeVaulted(STORE_KEYS.outbox, entries),
  updateOutboxEntry: async (clientMsgId: string, patch: Partial<OutboxEntry>) => {
    const all = await storage.getOutbox();
    const next = all.map((e) => (e.clientMsgId === clientMsgId ? { ...e, ...patch } : e));
    await storage.setOutbox(next);
    return next;
  },

  getMessageCache: () => readVaulted<import("@simbridge/shared").MessageDTO[]>(STORE_KEYS.messages, []),
  setMessageCache: (m: import("@simbridge/shared").MessageDTO[]) => writeVaulted(STORE_KEYS.messages, m),

  getLastSeq: () => getJSON<Record<string, number>>(STORE_KEYS.lastSeq, {}),
  setLastSeqMap: (m: Record<string, number>) => setJSON(STORE_KEYS.lastSeq, m),
  setLastSeqFor: async (pairId: string, seq: number) => {
    const all = await storage.getLastSeq();
    all[pairId] = Math.max(all[pairId] ?? 0, seq);
    await setJSON(STORE_KEYS.lastSeq, all);
  },

  getRouting: () => getJSON<Record<string, number>>(STORE_KEYS.routing, {}),
  setRouting: (r: Record<string, number>) => setJSON(STORE_KEYS.routing, r),

  getSmsWatermark: () => getJSON<number | null>(STORE_KEYS.smsWatermark, null),
  setSmsWatermark: (ts: number) => setJSON(STORE_KEYS.smsWatermark, ts),

  async wipe(): Promise<void> {
    await Promise.all([
      ...Object.values(STORE_KEYS).map((k) => AsyncStorage.removeItem(k).catch(() => undefined)),
      secrets.clear(),
    ]);
  },
};
