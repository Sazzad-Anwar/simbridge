/**
 * REST client for the SIMBridge API.
 * All requests/responses use the `{ ok, data | error }` envelope.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { ApiResponse } from "@simbridge/shared";
import { secrets } from "./storage";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const API_PORT = "3000";

/**
 * The backend URL is FIXED — derived automatically, never user-entered:
 *  1. `EXPO_PUBLIC_API_URL` env override (production builds / custom setups).
 *  2. The machine running Metro/Expo (`Constants.expoConfig.hostUri`), so on a
 *     physical phone over Wi-Fi the API resolves to `http://<your-pc-ip>:3000`,
 *     and on an Android emulator `localhost` maps to `10.0.2.2`.
 *  3. Fallback: `http://localhost:3000` (web / adb-reverse setups).
 */
function resolveServerUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override.replace(/\/+$/, "");

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.10:8081"
  if (hostUri) {
    let host = hostUri.split(":")[0];
    if ((host === "localhost" || host === "127.0.0.1") && Platform.OS === "android") {
      host = "10.0.2.2"; // Android emulator loopback to the host machine
    }
    return `http://${host}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

let serverUrl = resolveServerUrl();

export function getServerUrl(): string {
  return serverUrl;
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.auth !== false) {
    const token = await secrets.get("token");
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${serverUrl}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) throw new ApiClientError(json.error.code, json.error.message);
  return json.data;
}

export const api = {
  // auth
  register: (input: { name: string; role: "sender" | "receiver"; publicKey: string; platform?: string }) =>
    request<{
      deviceId: string;
      apiKey: string;
      accessToken: string;
      tokenType: string;
      expiresIn: number;
    }>("/auth/register", { method: "POST", body: input, auth: false }),
  token: (deviceId: string, apiKey: string) =>
    request<{ accessToken: string; tokenType: string; expiresIn: number }>("/auth/token", {
      method: "POST",
      body: { deviceId, apiKey },
      auth: false,
    }),

  // device / SIM registry
  me: () => request<import("@simbridge/shared").DeviceDTO>("/me"),
  updateMe: (patch: { name?: string; pushToken?: string }) =>
    request<import("@simbridge/shared").DeviceDTO>("/me", { method: "PATCH", body: patch }),
  setSims: (sims: import("@simbridge/shared").SimInfo[]) =>
    request<import("@simbridge/shared").SimInfo[]>("/me/sims", { method: "PUT", body: { sims } }),
  getSims: () => request<import("@simbridge/shared").SimInfo[]>("/me/sims"),

  // pairing
  listPairs: () => request<import("@simbridge/shared").PairDTO[]>("/pairs"),
  createPair: (input: { receiverDeviceId?: string; receiverPhoneNumber?: string }) =>
    request<import("@simbridge/shared").CreatePairResult>("/pairs", { method: "POST", body: input }),
  acceptPair: (code: string) =>
    request<import("@simbridge/shared").AcceptPairResult>(`/pairs/accept/${code}`, {
      method: "POST",
      body: {},
    }),
  revokePair: (pairId: string) =>
    request<{ revoked: boolean; pairId: string }>(`/pairs/${pairId}`, { method: "DELETE" }),

  // messages
  sendMessage: (input: import("@simbridge/shared").SendMessageInput) =>
    request<import("@simbridge/shared").SendMessageResult>("/messages", { method: "POST", body: input }),
  sync: (pairId: string, afterSeq: number, limit = 200) =>
    request<import("@simbridge/shared").SyncResult>(
      `/messages/sync?pairId=${encodeURIComponent(pairId)}&afterSeq=${afterSeq}&limit=${limit}`,
    ),
  ack: (messageIds: string[]) =>
    request<{ updated: number }>("/messages/ack", { method: "POST", body: { messageIds } }),

  // meta
  health: () =>
    request<{ status: string; mongo: string; version: string }>("/health", { auth: false }),
};
