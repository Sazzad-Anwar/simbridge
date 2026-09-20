import { createApp } from "../src/app.js";
import {
  base64ToBytes as cryptoBase64ToBytes,
  generateDeviceIdentity,
  generateSigningKeyPair,
  proveKeyPossession,
  fingerprintOf,
} from "@simbridge/crypto";

export interface TestIdentity {
  encPublicKey: string;
  encSecretKey: string;
  signPublicKey: string;
  signSecretKey: string;
  fingerprint: string;
}

let appInstance: ReturnType<typeof createApp> | null = null;
export function getApp() {
  appInstance ??= createApp();
  return appInstance;
}

export function base64ToBytes(b64: string): Uint8Array {
  return cryptoBase64ToBytes(b64);
}

/** Unique x-forwarded-for per request keeps test traffic off shared rate buckets. */
export function uniqueIp(): string {
  return `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${
    Math.floor(Math.random() * 254) + 1
  }`;
}

export async function api(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    token?: string;
    ip?: string;
  } = {},
): Promise<{ status: number; body: any }> {
  const app = getApp();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": init.ip ?? uniqueIp(),
  };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const res = await app.handle(
    new Request(`http://test.local${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    }),
  );
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { status: res.status, body };
}

export function freshIdentity(): TestIdentity {
  return { ...generateDeviceIdentity() };
}

export function signChallenge(secretKeyB64: string, challengeB64: string): string {
  return proveKeyPossession(secretKeyB64, base64ToBytes(challengeB64));
}

/** Issue a fresh single-use register challenge via the public endpoint. */
export async function issueRegisterChallenge(): Promise<{
  challengeId: string;
  challenge: string;
}> {
  const res = await api("/auth/challenge/register", { method: "POST" });
  if (res.status !== 200) throw new Error(`challenge issuance failed: ${res.status}`);
  return {
    challengeId: res.body.data.challengeId,
    challenge: res.body.data.challenge,
  };
}

/** Register a device (optionally hardened with a signing key + real PoP). */
export async function registerDevice(
  name: string,
  identity: TestIdentity,
  opts: {
    role?: "sender" | "receiver";
    platform?: "android" | "ios";
    hardened?: boolean;
    challengeId?: string;
    challengePoP?: string;
    signingPublicKey?: string;
    signingKeyFingerprint?: string;
  } = {},
) {
  const hardened = opts.hardened ?? true;
  const signingPublicKey = opts.signingPublicKey ?? identity.signPublicKey;
  const signingKeyFingerprint = opts.signingKeyFingerprint ?? identity.fingerprint;

  let challengeId = opts.challengeId;
  let challengePoP = opts.challengePoP;
  if (hardened && (challengeId === undefined || challengePoP === undefined)) {
    const { challengeId: id, challenge } = await issueRegisterChallenge();
    challengeId = id;
    challengePoP = signChallenge(identity.signSecretKey, challenge);
  }

  return api("/auth/register", {
    method: "POST",
    body: {
      name,
      role: opts.role ?? "sender",
      platform: opts.platform ?? "android",
      publicKey: identity.encPublicKey,
      ...(hardened && {
        signingPublicKey,
        signingKeyFingerprint,
        challengeId,
        challengePoP,
      }),
    },
  });
}

/** Add/rotate a signing key on an authenticated device via the re-key flow. */
export async function rekeyDevice(
  token: string,
  encPublicKey: string,
  existing: { signSecretKey?: string; signPublicKey: string },
  newSign: { signPublicKey: string },
) {
  const issue = await api("/auth/challenge/rekey", { method: "POST", token });
  if (issue.status !== 200) throw new Error(`rekey challenge failed: ${issue.status}`);
  const challenge = issue.body.data.challenge;
  const attestKey = existing.signSecretKey ?? newSign.signPublicKey;
  const challengePoP = proveKeyPossession(attestKey, base64ToBytes(challenge));
  return api("/me", {
    method: "PATCH",
    token,
    body: {
      signingPublicKey: newSign.signPublicKey,
      signingKeyFingerprint: fingerprintOf(encPublicKey, newSign.signPublicKey),
      challengeId: issue.body.data.challengeId,
      challengePoP,
    },
  });
}

export { generateSigningKeyPair };