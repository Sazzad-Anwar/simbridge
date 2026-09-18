/**
 * Local persistence layer.
 *  - Keystore-grade secrets (identity keys, apiKey, token) -> expo-secure-store
 *  - Regular state (settings, outbox, message cache, lastSeq cursors) -> AsyncStorage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const SECURE_KEYS = {
  secretKey: "simbridge.identity.secretKey",
  publicKey: "simbridge.identity.publicKey",
  apiKey: "simbridge.identity.apiKey",
  deviceId: "simbridge.identity.deviceId",
  token: "simbridge.identity.token",
} as const;

const STORE_KEYS = {
  serverUrl: "simbridge.serverUrl.v1",
  profile: "simbridge.profile.v1", // { name, role }
  outbox: "simbridge.outbox.v1", // EncryptedOutboxEntry[]
  messages: "simbridge.messages.v1", // MessageDTO[] cache (receiver inbox)
  lastSeq: "simbridge.lastSeq.v1", // Record<pairId, number>
  routing: "simbridge.routing.v1", // Record<receiverNumber, subscriptionId>
} as const;

export interface StoredProfile {
  name: string;
  role: "sender" | "receiver";
}

export interface OutboxEntry {
  clientMsgId: string;
  pairId: string;
  receiverNumber: string;
  smsBody: string; // plaintext kept ONLY in device-local encrypted storage
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

// ---- Regular JSON storage ----
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

export const storage = {
  getServerUrl: () => AsyncStorage.getItem(STORE_KEYS.serverUrl),
  setServerUrl: (url: string) => AsyncStorage.setItem(STORE_KEYS.serverUrl, url),
  getProfile: () => getJSON<StoredProfile | null>(STORE_KEYS.profile, null),
  setProfile: (p: StoredProfile) => setJSON(STORE_KEYS.profile, p),

  getOutbox: () => getJSON<OutboxEntry[]>(STORE_KEYS.outbox, []),
  setOutbox: (entries: OutboxEntry[]) => setJSON(STORE_KEYS.outbox, entries),
  updateOutboxEntry: async (clientMsgId: string, patch: Partial<OutboxEntry>) => {
    const all = await storage.getOutbox();
    const next = all.map((e) => (e.clientMsgId === clientMsgId ? { ...e, ...patch } : e));
    await storage.setOutbox(next);
    return next;
  },

  getMessageCache: () => getJSON<import("@simbridge/shared").MessageDTO[]>(STORE_KEYS.messages, []),
  setMessageCache: (m: import("@simbridge/shared").MessageDTO[]) => setJSON(STORE_KEYS.messages, m),

  getLastSeq: () => getJSON<Record<string, number>>(STORE_KEYS.lastSeq, {}),
  setLastSeqMap: (m: Record<string, number>) => setJSON(STORE_KEYS.lastSeq, m),
  setLastSeqFor: async (pairId: string, seq: number) => {
    const all = await storage.getLastSeq();
    all[pairId] = Math.max(all[pairId] ?? 0, seq);
    await setJSON(STORE_KEYS.lastSeq, all);
  },

  getRouting: () => getJSON<Record<string, number>>(STORE_KEYS.routing, {}),
  setRouting: (r: Record<string, number>) => setJSON(STORE_KEYS.routing, r),

  async wipe(): Promise<void> {
    await Promise.all([
      ...Object.values(STORE_KEYS).map((k) => AsyncStorage.removeItem(k).catch(() => undefined)),
      secrets.clear(),
    ]);
  },
};
