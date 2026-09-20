/**
 * Device store — registration state, role, profile, pairs, connection status.
 */
import { create } from "zustand";
import type { DeviceDTO, PairDTO, SimInfo } from "@simbridge/shared";
// Randomness polyfill MUST run before @simbridge/crypto loads (tweetnacl
// captures its PRNG when the module is evaluated). See src/lib/random-polyfill.ts.
import { api } from "../lib/api";
import { secrets, storage } from "../lib/storage";
import {
  generateDeviceIdentity,
  generateSigningKeyPair,
  fingerprintOf,
  proveKeyPossession,
  base64ToBytes,
  randomBytes,
  bytesToBase64,
} from "@simbridge/crypto";
import { ApiClientError } from "../lib/api";

export type ConnectionStatus = "connecting" | "online" | "offline" | "none";

/** Device-local identity. Encryption keys are the legacy X25519 pair; the
 * signing keys harden the identity for V1. Both halves live ONLY in SecureStore. */
interface LocalIdentity {
  publicKey: string;
  secretKey: string;
  signPublicKey: string;
  signSecretKey: string;
  fingerprint: string;
  vaultKey: string;
}

export class DeviceKeyMismatchError extends Error {
  constructor(message = "Device keys changed on this install; re-pairing required") {
    super(message);
    this.name = "DeviceKeyMismatchError";
  }
}

interface DeviceState {
  hydrated: boolean;
  registered: boolean;
  profile: { name: string; role: "sender" | "receiver" } | null;
  device: DeviceDTO | null;
  pairs: PairDTO[];
  sims: SimInfo[];
  connection: ConnectionStatus;
  /**
   * Set when the device's keys diverge from the server (DEVICE_KEY_CHANGED) or
   * the local identity is inconsistent. Blocks V1 messaging and pins a warning.
   */
  needsRepair: boolean;

  hydrate: () => Promise<void>;
  /** Strict key lifecycle: reuse existing → migrate legacy → generate once. */
  ensureIdentityKeys: () => Promise<LocalIdentity>;
  registerDevice: (input: {
    name: string;
    role: "sender" | "receiver";
  }) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshPairs: () => Promise<void>;
  refreshSims: (sims?: SimInfo[]) => Promise<void>;
  setConnection: (c: ConnectionStatus) => Promise<void>;
  /** Patch the live presence of a paired peer onto every pair it belongs to. */
  applyPeerPresence: (deviceId: string, online: boolean, lastSeenAt?: string) => void;
  setNeedsRepair: (flag: boolean) => void;
  reset: () => Promise<void>;
}

/** Recover the stored identity or produce the correct keys, in strict order:
 *  use existing keys → migrate a legacy (V0) install → generate a fresh identity.
 *  Never regenerates a key that already exists, never overwrites an existing pair. */
async function ensureLocalIdentity(): Promise<LocalIdentity> {
  const [
    publicKey,
    secretKey,
    signPublicKey,
    signSecretKey,
    fingerprint,
    vaultKey,
  ] = await Promise.all([
    secrets.get("publicKey"),
    secrets.get("secretKey"),
    secrets.get("signPublicKey"),
    secrets.get("signSecretKey"),
    secrets.get("signPublicKeyFingerprint"),
    secrets.get("vaultKey"),
  ]);

  const hasEnc = Boolean(publicKey && secretKey);
  const hasSign = Boolean(signPublicKey && signSecretKey);
  const consistentPair =
    hasEnc &&
    hasSign &&
    fingerprint != null &&
    fingerprint === fingerprintOf(publicKey!, signPublicKey!);

  if (consistentPair) {
    return {
      publicKey: publicKey!,
      secretKey: secretKey!,
      signPublicKey: signPublicKey!,
      signSecretKey: signSecretKey!,
      fingerprint: fingerprint!,
      vaultKey: vaultKey ?? (await storeFreshVaultKey()),
    };
  }

  if (hasEnc && !hasSign) {
    // Legacy (V0) install: keep the encryption identity, add signing keys once.
    const sign = generateSigningKeyPair();
    const fp = fingerprintOf(publicKey!, sign.signPublicKey);
    await secrets.set("signPublicKey", sign.signPublicKey);
    await secrets.set("signSecretKey", sign.signSecretKey);
    await secrets.set("signPublicKeyFingerprint", fp);
    return {
      publicKey: publicKey!,
      secretKey: secretKey!,
      signPublicKey: sign.signPublicKey,
      signSecretKey: sign.signSecretKey,
      fingerprint: fp,
      vaultKey: vaultKey ?? (await storeFreshVaultKey()),
    };
  }

  if (!hasEnc) {
    // Fresh install (or keys wiped): generate exactly once.
    const id = generateDeviceIdentity();
    await secrets.set("publicKey", id.encPublicKey);
    await secrets.set("secretKey", id.encSecretKey);
    await secrets.set("signPublicKey", id.signPublicKey);
    await secrets.set("signSecretKey", id.signSecretKey);
    await secrets.set("signPublicKeyFingerprint", id.fingerprint);
    const vk = await storeFreshVaultKey();
    return {
      publicKey: id.encPublicKey,
      secretKey: id.encSecretKey,
      signPublicKey: id.signPublicKey,
      signSecretKey: id.signSecretKey,
      fingerprint: id.fingerprint,
      vaultKey: vk,
    };
  }

  // Keys are partial/inconsistent in a way that cannot be safely repaired.
  // Any silently-picked subset would permanently break message decryption.
  throw new DeviceKeyMismatchError();
}

async function storeFreshVaultKey(): Promise<string> {
  const vaultKey = bytesToBase64(randomBytes(32));
  await secrets.set("vaultKey", vaultKey);
  return vaultKey;
}

/** Sign a server challenge with the identity's signing key. */
function signChallengePopp(identity: LocalIdentity, challenge: string): string {
  return proveKeyPossession(identity.signSecretKey, base64ToBytes(challenge));
}

/** Add the local signing key to a legacy server-side device (self-attestation). */
async function addSigningKey(identity: LocalIdentity): Promise<void> {
  const { challengeId, challenge } = await api.challengeRekey();
  const challengePoP = signChallengePopp(identity, challenge);
  await api.updateMe({
    signingPublicKey: identity.signPublicKey,
    signingKeyFingerprint: identity.fingerprint,
    challengeId,
    challengePoP,
  });
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  hydrated: false,
  registered: false,
  profile: null,
  device: null,
  pairs: [],
  sims: [],
  connection: "none",
  needsRepair: false,

  async hydrate() {
    const profile = await storage.getProfile();
    if (profile) {
      const [deviceId, token] = await Promise.all([secrets.get("deviceId"), secrets.get("token")]);
      const registered = !!(deviceId && token);
      set({ profile, registered, hydrated: true, connection: registered ? "connecting" : "none" });
    } else {
      set({ hydrated: true });
    }
  },

  async ensureIdentityKeys() {
    return ensureLocalIdentity();
  },

  async registerDevice({ name, role }) {
    // Server URL is fixed and auto-resolved (see src/lib/api.ts) — no user input.
    let identity: LocalIdentity;
    try {
      identity = await ensureLocalIdentity();
    } catch (err) {
      if (err instanceof DeviceKeyMismatchError) get().setNeedsRepair(true);
      throw err;
    }

    const deviceId = await secrets.get("deviceId");
    const apiKey = await secrets.get("apiKey");
    let token: string | null = null;

    if (deviceId && apiKey) {
      // Re-register flow: refresh the token, update profile server-side.
      const res = await api.token(deviceId, apiKey);
      token = res.accessToken;
      await secrets.set("token", token);
      await api.updateMe({ name });

      // If this install was legacy (no signing key on the server) the local
      // upgrade must be reflected server-side so this device can speak V1.
      try {
        const me = await api.me();
        if (me.signingPublicKey === identity.signPublicKey) {
          // already hardened with our exact key — nothing to do
        } else if (!me.signingPublicKey) {
          await addSigningKey(identity);
        } else {
          // Server holds a DIFFERENT signing key than this install — never
          // clobber it silently; block and require an explicit recovery path.
          throw new ApiClientError(
            "DEVICE_KEY_CHANGED",
            "The server has a different device identity. Remove this device and re-pair.",
          );
        }
      } catch (err) {
        if (err instanceof DeviceKeyMismatchError) {
          get().setNeedsRepair(true);
          throw err;
        }
        if (err instanceof ApiClientError && err.code === "DEVICE_KEY_CHANGED") {
          get().setNeedsRepair(true);
          throw err;
        }
        // Transient failure (offline / 5xx) — registration still succeeded.
      }
    } else {
      const { challengeId, challenge } = await api.challengeRegister();
      const challengePoP = signChallengePopp(identity, challenge);
      const res = await api.register({
        name,
        role,
        publicKey: identity.publicKey,
        platform: "android",
        signingPublicKey: identity.signPublicKey,
        signingKeyFingerprint: identity.fingerprint,
        challengeId,
        challengePoP,
      });
      await secrets.set("deviceId", res.deviceId);
      await secrets.set("apiKey", res.apiKey);
      token = res.accessToken;
      await secrets.set("token", token);
      await api.updateMe({ name });
      // The backend is authoritative about the role (a reclaim may return one
      // that differs from the freshly picked role after a local data wipe).
      role = res.role;
    }

    const newProfile = { name, role };
    await storage.setProfile(newProfile);
    set({ profile: newProfile, registered: true });
    await get().refreshAll();
  },

  async refreshAll() {
    try {
      const device = await api.me();
      set({ device, sims: device.sims ?? [] });
      await get().refreshPairs();
    } catch {
      // Network hiccup — keep cached state; socket layer will retry.
    }
  },

  async refreshPairs() {
    try {
      const pairs = await api.listPairs();
      set({ pairs });
    } catch {
      /* offline — keep cache */
    }
  },

  async refreshSims(sims) {
    try {
      const list = sims ?? (await (await import("../native/sms-bridge")).smsBridge.listSims());
      if (list.length > 0) {
        const saved = await api.setSims(list);
        set({ sims: saved });
      }
    } catch {
      /* offline — keep cache */
    }
  },

  async setConnection(connection) {
    if (get().connection !== connection) set({ connection });
  },

  applyPeerPresence(deviceId, online, lastSeenAt) {
    const pairs = get().pairs.map((p): PairDTO => {
      if (p.senderDeviceId !== deviceId && p.receiverDeviceId !== deviceId) return p;
      return {
        ...p,
        peerStatus: online ? "online" : "offline",
        peerLastSeenAt: lastSeenAt ?? p.peerLastSeenAt,
      };
    });
    set({ pairs });
  },

  setNeedsRepair(flag) {
    if (get().needsRepair !== flag) set({ needsRepair: flag });
  },

  async reset() {
    await storage.wipe();
    set({
      registered: false,
      profile: null,
      device: null,
      pairs: [],
      sims: [],
      connection: "none",
      needsRepair: false,
    });
  },
}));
