/**
 * Device store — registration state, role, profile, pairs, connection status.
 */
import { create } from "zustand";
import type { DeviceDTO, PairDTO, SimInfo } from "@simbridge/shared";
// Randomness polyfill MUST run before @simbridge/crypto loads (tweetnacl
// captures its PRNG when the module is evaluated). See src/lib/random-polyfill.ts.
import "../lib/random-polyfill";
import { api, initServerUrl, setServerUrl, getServerUrl } from "../lib/api";
import { secrets, storage } from "../lib/storage";
import { generateKeyPair } from "@simbridge/crypto";

export type ConnectionStatus = "connecting" | "online" | "offline" | "none";

interface DeviceState {
  hydrated: boolean;
  registered: boolean;
  profile: { name: string; role: "sender" | "receiver"; serverUrl: string } | null;
  device: DeviceDTO | null;
  pairs: PairDTO[];
  sims: SimInfo[];
  connection: ConnectionStatus;

  hydrate: () => Promise<void>;
  registerDevice: (input: {
    name: string;
    role: "sender" | "receiver";
    serverUrl: string;
  }) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshPairs: () => Promise<void>;
  refreshSims: (sims?: SimInfo[]) => Promise<void>;
  setConnection: (c: ConnectionStatus) => Promise<void>;
  reset: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  hydrated: false,
  registered: false,
  profile: null,
  device: null,
  pairs: [],
  sims: [],
  connection: "none",

  async hydrate() {
    const profile = await storage.getProfile();
    if (profile) {
      initServerUrl(profile.serverUrl);
      const [deviceId, token] = await Promise.all([secrets.get("deviceId"), secrets.get("token")]);
      const registered = !!(deviceId && token);
      set({ profile, registered, hydrated: true, connection: registered ? "connecting" : "none" });
    } else {
      set({ hydrated: true });
    }
  },

  async registerDevice({ name, role, serverUrl }) {
    setServerUrl(serverUrl);

    // Fresh identity key pair generated ON DEVICE (never leaves the phone).
    let publicKey = await secrets.get("publicKey");
    if (!publicKey) {
      const kp = generateKeyPair();
      await secrets.set("publicKey", kp.publicKey);
      await secrets.set("secretKey", kp.secretKey);
      publicKey = kp.publicKey;
    }

    const deviceId = await secrets.get("deviceId");
    const apiKey = await secrets.get("apiKey");
    let token: string | null = null;

    if (deviceId && apiKey) {
      // Re-register flow: refresh the token, update profile server-side.
      const res = await api.token(deviceId, apiKey);
      token = res.accessToken;
      await api.updateMe({ name });
    } else {
      const res = await api.register({ name, role, publicKey, platform: "android" });
      await secrets.set("deviceId", res.deviceId);
      await secrets.set("apiKey", res.apiKey);
      token = res.accessToken;
      await api.updateMe({ name });
    }

    await secrets.set("token", token!);

    const newProfile = { name, role, serverUrl };
    await storage.setProfile(newProfile);
    set({ profile: newProfile, registered: true });
    await get().refreshAll();
  },

  async refreshAll() {
    try {
      const device = await api.me();
      setServerUrl(get().profile?.serverUrl || getServerUrl());
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

  async reset() {
    await storage.wipe();
    set({
      registered: false,
      profile: null,
      device: null,
      pairs: [],
      sims: [],
      connection: "none",
    });
  },
}));
