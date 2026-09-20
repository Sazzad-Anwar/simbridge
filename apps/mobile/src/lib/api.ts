/**
 * REST client for the SIMBridge API.
 * All requests/responses use the `{ ok, data | error }` envelope.
 */
import Constants from 'expo-constants'
import { NativeModules, Platform } from 'react-native'
import type { ApiResponse } from '@simbridge/shared'
import { secrets } from './storage'

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const API_PORT = '3000'

let customServerUrl: string | null = null

export function setCustomServerUrl(url: string | null) {
  customServerUrl = url ? url.trim().replace(/\/+$/, '') : null
}

/**
 * The backend URL is derived automatically:
 *  1. User/runtime custom override (if configured).
 *  2. `EXPO_PUBLIC_API_URL` env override.
 *  3. React Native Metro `NativeModules.SourceCode.scriptURL` host (detects computer LAN IP on physical devices).
 *  4. Expo `Constants.expoConfig.hostUri`.
 *  5. Fallback: dev machine LAN IP (Android physical device) / `localhost`.
 */
// LAN IP of the dev machine (the Mac the backend runs on).
const DEVICE_DEFAULT_HOST = '192.168.0.186'

// Hosted backend (production/release builds without EXPO_PUBLIC_API_URL).
const PRODUCTION_API_URL = 'https://simbridge-m2ah.onrender.com'

function resolveServerUrl(): string {
  if (customServerUrl) return customServerUrl

  const override = process.env.EXPO_PUBLIC_API_URL
  if (override) return override.replace(/\/+$/, '')

  // Detect Metro dev server host from scriptURL (e.g. http://192.168.0.186:8081/index.bundle?...)
  const scriptURL: string | undefined = (NativeModules as Record<string, any>)
    ?.SourceCode?.scriptURL
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^:/]+)/)
    if (match && match[1]) {
      const host = match[1]
      if (host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:${API_PORT}`
      }
    }
  }

  const hostUri = Constants.expoConfig?.hostUri // e.g. "192.168.1.10:8081"
  if (hostUri) {
    let host = hostUri.split(':')[0]
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:${API_PORT}`
    }
  }

  // Real Android device: call the dev machine's LAN IP directly so the phone
  // can reach the backend on port 3000 over the network (no emulator alias).
  // In release builds, fall back to the hosted backend.
  if (!__DEV__) return PRODUCTION_API_URL
  const defaultHost = Platform.OS === 'android' ? DEVICE_DEFAULT_HOST : 'localhost'
  return `http://${defaultHost}:${API_PORT}`
}

export function getServerUrl(): string {
  return customServerUrl || resolveServerUrl()
}

async function request<T>(
  path: string,
  init: {
    method?: string
    body?: unknown
    auth?: boolean
    timeoutMs?: number
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init.auth !== false) {
    const token = await secrets.get('token')
    if (token) headers.authorization = `Bearer ${token}`
  }
  const controller = new AbortController()
  const timer =
    init.timeoutMs != null
      ? setTimeout(() => controller.abort(), init.timeoutMs)
      : undefined
  try {
    const res = await fetch(`${getServerUrl()}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    })
    const json = (await res.json()) as ApiResponse<T>
    if (!json.ok) throw new ApiClientError(json.error.code, json.error.message)
    return json.data
  } catch (err) {
    // An aborted signal means the timeout fired — surface a clear, actionable
    // error instead of the raw "Aborted"/network exception.
    if (controller.signal.aborted) {
      throw new ApiClientError(
        'TIMEOUT',
        `no response within ${(init.timeoutMs ?? 0) / 1000}s — is the device on the same Wi-Fi and is port ${API_PORT} allowed through the firewall?`,
      )
    }
    throw err
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const api = {
  // auth
  challengeRegister: (): Promise<import('@simbridge/shared').ChallengeToken> =>
    request<import('@simbridge/shared').ChallengeToken>('/auth/challenge/register', {
      method: 'POST',
      auth: false,
    }),
  challengeRekey: (): Promise<import('@simbridge/shared').ChallengeToken> =>
    request<import('@simbridge/shared').ChallengeToken>('/auth/challenge/rekey', {
      method: 'POST',
    }),
  register: (input: {
    name: string
    role: 'sender' | 'receiver'
    publicKey: string
    platform?: string
    signingPublicKey?: string
    signingKeyFingerprint?: string
    challengeId?: string
    challengePoP?: string
  }) =>
    request<import('@simbridge/shared').RegisterResult>('/auth/register', {
      method: 'POST',
      body: input,
      auth: false,
    }),
  token: (deviceId: string, apiKey: string) =>
    request<{ accessToken: string; tokenType: string; expiresIn: number }>(
      '/auth/token',
      {
        method: 'POST',
        body: { deviceId, apiKey },
        auth: false,
      },
    ),

  // device / SIM registry
  me: () => request<import('@simbridge/shared').DeviceDTO>('/me'),
  updateMe: (patch: {
    name?: string
    pushToken?: string
    signingPublicKey?: string
    signingKeyFingerprint?: string
    challengeId?: string
    challengePoP?: string
  }) =>
    request<import('@simbridge/shared').DeviceDTO>('/me', {
      method: 'PATCH',
      body: patch,
    }),
  setSims: (sims: import('@simbridge/shared').SimInfo[]) =>
    request<import('@simbridge/shared').SimInfo[]>('/me/sims', {
      method: 'PUT',
      body: { sims },
    }),
  getSims: () => request<import('@simbridge/shared').SimInfo[]>('/me/sims'),

  // pairing
  listPairs: () => request<import('@simbridge/shared').PairDTO[]>('/pairs'),
  createPair: (input: {
    receiverDeviceId?: string
    receiverPhoneNumber?: string
  }) =>
    request<import('@simbridge/shared').CreatePairResult>('/pairs', {
      method: 'POST',
      body: input,
    }),
  acceptPair: (code: string) =>
    request<import('@simbridge/shared').AcceptPairResult>(
      `/pairs/accept/${code}`,
      {
        method: 'POST',
        body: {},
      },
    ),
  revokePair: (pairId: string) =>
    request<{ revoked: boolean; pairId: string }>(`/pairs/${pairId}`, {
      method: 'DELETE',
    }),
  /** Record that I visually verified the other device's fingerprint (V1 gate). */
  confirmPairFingerprint: (pairId: string) =>
    request<import('@simbridge/shared').PairDTO>(`/pairs/${pairId}/confirm`, {
      method: 'POST',
      body: {},
    }),

  // messages
  sendMessage: (input: import('@simbridge/shared').SendMessageInput) =>
    request<import('@simbridge/shared').SendMessageResult>('/messages', {
      method: 'POST',
      body: input,
    }),
  checkExists: (pairId: string, clientMsgIds: string[]) =>
    request<import('@simbridge/shared').ExistsResult>('/messages/exists', {
      method: 'POST',
      body: { pairId, clientMsgIds },
    }),
  sync: (pairId: string, afterSeq: number, limit = 200) =>
    request<import('@simbridge/shared').SyncResult>(
      `/messages/sync?pairId=${encodeURIComponent(pairId)}&afterSeq=${afterSeq}&limit=${limit}`,
    ),
  ack: (messageIds: string[]) =>
    request<{ updated: number }>('/messages/ack', {
      method: 'POST',
      body: { messageIds },
    }),

  // meta
  health: () =>
    request<{ status: string; mongo: string; version: string }>('/health', {
      auth: false,
      timeoutMs: 8_000, // fast feedback on the onboarding "Continue" check
    }),
}
