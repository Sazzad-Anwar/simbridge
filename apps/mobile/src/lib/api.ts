/**
 * REST client for the SIMBridge API.
 * All requests/responses use the `{ ok, data | error }` envelope.
 */
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

let serverUrl = "http://localhost:3000";

export function setServerUrl(url: string): void {
  serverUrl = url.replace(/\/+$/, "");
}

export function getServerUrl(): string {
  return serverUrl;
}

export function initServerUrl(url: string): void {
  serverUrl = url.replace(/\/+$/, "");
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
