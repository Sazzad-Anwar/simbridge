import { Elysia, t } from "elysia";
import type { Role } from "@simbridge/shared";
import { Device } from "../db/models/device.js";
import { audit } from "../db/models/audit.js";
import { signAccessToken, hashApiKey } from "../auth/tokens.js";
import { generateApiKey, newId } from "../utils/ids.js";
import { errors } from "../utils/errors.js";
import { env } from "../config/env.js";
import {
  base64ToBytes,
  fingerprintOf,
  isValidPublicKey,
  isValidSigningPublicKey,
  verifyKeyPossession,
} from "@simbridge/crypto";
import { isValidPhoneNumber, normalizePhoneNumber } from "@simbridge/shared";
import type { RegisterResult, TokenResult } from "@simbridge/shared";
import { authGuard } from "../auth/guard.js";
import { consumeChallenge, issueChallenge } from "../services/challenges.js";

interface ReclaimPatch {
  publicKey: string;
  platform: string;
  pushToken?: string;
  signingPublicKey?: string;
  signingKeyFingerprint?: string;
  keysProvenAt?: Date;
  protocolVersion?: 0 | 1;
}

async function reclaimDevice(
  deviceId: string,
  role: Role,
  patch: ReclaimPatch,
): Promise<RegisterResult> {
  const apiKey = generateApiKey();
  const $set: Record<string, unknown> = {
    apiKeyHash: hashApiKey(apiKey),
    publicKey: patch.publicKey,
    platform: patch.platform,
    ...(patch.pushToken ? { pushToken: patch.pushToken } : {}),
    lastSeenAt: new Date(),
  };
  if (patch.signingPublicKey !== undefined) $set.signingPublicKey = patch.signingPublicKey;
  if (patch.signingKeyFingerprint !== undefined) {
    $set.signingKeyFingerprint = patch.signingKeyFingerprint;
  }
  if (patch.keysProvenAt !== undefined) $set.keysProvenAt = patch.keysProvenAt;
  if (patch.protocolVersion !== undefined) $set.protocolVersion = patch.protocolVersion;

  await Device.updateOne({ deviceId }, { $set });
  const accessToken = await signAccessToken({ deviceId, role });
  return {
    deviceId,
    apiKey,
    accessToken,
    tokenType: "Bearer",
    expiresIn: env.accessTokenTtlSeconds,
    role,
  };
}

/** Verify a proof-of-possession over a consumed challenge for a signing key. */
async function requirePoP(input: {
  challengeId: string;
  challengePoP: string;
  signingPublicKey: string;
}): Promise<void> {
  const challenge = await consumeChallenge({
    challengeId: input.challengeId,
    purpose: "register",
  });
  const ok = verifyKeyPossession(
    input.signingPublicKey,
    base64ToBytes(challenge),
    input.challengePoP,
  );
  if (!ok) throw errors.invalidSignature("Proof of possession for the signing key failed");
}

/** Public challenge issuance (fresh registration — no device exists yet). */
export const registerChallengeRoutes = new Elysia({
  prefix: "/challenge/register",
  tags: ["auth"],
}).post(
  "/",
  async () => {
    const issued = await issueChallenge({ purpose: "register" });
    return { ok: true as const, data: issued };
  },
  {
    detail: {
      summary: "Issue a single-use registration challenge",
      description:
        "Returns a short-lived challenge a fresh device signs with its new Ed25519 key to prove possession. Single-use, 5-minute TTL, cryptographically random.",
    },
  },
);

/** Authenticated challenge issuance — for key rotation / signing-key addition. */
export const rekeyChallengeRoutes = new Elysia({
  prefix: "/challenge/rekey",
  tags: ["auth"],
})
  .use(authGuard)
  .post(
    "/",
    async ({ auth }) => {
      const issued = await issueChallenge({ purpose: "rekey", deviceId: auth.deviceId });
      return { ok: true as const, data: issued };
    },
    {
      detail: {
        summary: "Issue an authenticated re-key challenge",
        description:
          "A signed proof-of-possession challenge bound to the authenticated device, used when replacing or adding a device signing key via PATCH /me.",
      },
    },
  );

export const authRoutes = new Elysia({ prefix: "/auth", tags: ["auth"] })
  // Single-use PoP challenge issuance lives under /auth/challenge/*.
  .use(registerChallengeRoutes)
  .use(rekeyChallengeRoutes)
  .post(
    "/register",
    async ({ body, set }) => {
      if (!isValidPublicKey(body.publicKey)) {
        throw errors.validation("publicKey must be a base64-encoded 32-byte X25519 key");
      }

      const name = normalizePhoneNumber(body.name);
      if (!isValidPhoneNumber(name)) {
        throw errors.validation("name must be a phone number (e.g. +15551234567)");
      }

      // --- V1 signing key validation + single-use proof of possession -------
      // `signingKey` is only non-null when the request is fully hardened:
      // the submitted signing key is well-formed, its fingerprint matches the
      // supplied encryption key, and possession of the key was proven against
      // a fresh single-use server challenge.
      let signingKey: { publicKey: string; fingerprint: string } | null = null;
      {
        const sk = body.signingPublicKey;
        if (sk !== undefined) {
          if (!isValidSigningPublicKey(sk)) {
            throw errors.validation("signingPublicKey must be a base64-encoded 32-byte Ed25519 key");
          }
          if (!body.signingKeyFingerprint) {
            throw errors.validation("signingKeyFingerprint is required with signingPublicKey");
          }
          const fp = fingerprintOf(body.publicKey, sk);
          if (body.signingKeyFingerprint !== fp) {
            throw errors.validation("signingKeyFingerprint does not match the supplied keys");
          }
          const challengeId = body.challengeId;
          const challengePoP = body.challengePoP;
          if (!challengeId || !challengePoP) {
            throw errors.keyPoPRequired(
              "Registering a signing key requires a proof-of-possession challenge",
            );
          }
          await requirePoP({ challengeId, challengePoP, signingPublicKey: sk });
          signingKey = { publicKey: sk, fingerprint: fp };
        }
      }
      const hardened = signingKey !== null;

      const devicePatch = {
        publicKey: body.publicKey,
        platform: body.platform ?? "android",
        pushToken: body.pushToken,
      };

      const existing = await Device.findOne({ name })
        .select("deviceId role publicKey signingPublicKey")
        .lean<{
          deviceId: string;
          role: Role;
          publicKey: string;
          signingPublicKey?: string;
        } | null>();
      if (existing) {
        // Same identity: the submitted enc key matches, and either neither has
        // a signing key or the signing keys match.
        const sameIdentity =
          existing.publicKey === body.publicKey &&
          (!existing.signingPublicKey || existing.signingPublicKey === signingKey?.publicKey);

        if (!sameIdentity) {
          // A hardened device's identity cannot be swapped out via a fresh
          // registration claim — key replacement requires the rotation path.
          if (existing.signingPublicKey) throw errors.deviceKeyChanged();
          // Legacy (pre-hardening) device: transition is allowed, but only with
          // a signed proof of possession for the new identity.
          if (!hardened) throw errors.keyPoPRequired();
        } else if (hardened && existing.signingPublicKey) {
          // Re-authenticating a hardened identity still requires PoP.
          if (!signingKey) throw errors.keyPoPRequired();
        }

        const result = await reclaimDevice(existing.deviceId, existing.role, {
          ...devicePatch,
          ...(signingKey
            ? {
                signingPublicKey: signingKey.publicKey,
                signingKeyFingerprint: signingKey.fingerprint,
                keysProvenAt: new Date(),
                protocolVersion: 1 as const,
              }
            : {}),
        });
        audit("device.reclaimed", {
          deviceId: existing.deviceId,
          meta: { role: existing.role, hardened },
        });
        set.status = 200;
        return { ok: true as const, data: result };
      }

      const apiKey = generateApiKey();
      const deviceId = newId("dev");

      try {
        await Device.create({
          deviceId,
          apiKeyHash: hashApiKey(apiKey),
          name,
          platform: devicePatch.platform,
          role: body.role,
          publicKey: body.publicKey,
          ...(signingKey
            ? {
                signingPublicKey: signingKey.publicKey,
                signingKeyFingerprint: signingKey.fingerprint,
                protocolVersion: 1 as const,
                keysProvenAt: new Date(),
              }
            : {}),
          pushToken: body.pushToken,
          status: "offline",
        });
      } catch (err) {
        const mongoError = err as { code?: number };
        if (mongoError.code === 11000) {
          const winner = await Device.findOne({ name })
            .select("deviceId role")
            .lean<{ deviceId: string; role: Role } | null>();
          if (winner) {
            const result = await reclaimDevice(winner.deviceId, winner.role, devicePatch);
            audit("device.reclaimed", { deviceId: winner.deviceId, meta: { role: winner.role } });
            set.status = 200;
            return { ok: true as const, data: result };
          }
        }
        throw err;
      }

      const accessToken = await signAccessToken({ deviceId, role: body.role });
      audit("device.registered", {
        deviceId,
        meta: { role: body.role, platform: body.platform, hardened },
      });

      const result: RegisterResult = {
        deviceId,
        apiKey,
        accessToken,
        tokenType: "Bearer",
        expiresIn: env.accessTokenTtlSeconds,
        role: body.role,
      };
      set.status = 201;
      return { ok: true as const, data: result };
    },
    {
      detail: {
        summary: "Register a device",
        description:
          "Step 1 of the feature flow. The app generates its encryption + signing key pairs locally, obtains a proof-of-possession challenge, and registers. Registering an already-registered number reclaims that device only when the submitted keys match the registered identity; a hardened identity can never be silently replaced (DEVICE_KEY_CHANGED).",
      },
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 30, error: "name is required (a phone number)" }),
        role: t.Union([t.Literal("sender"), t.Literal("receiver")]),
        publicKey: t.String({ minLength: 40, maxLength: 100 }),
        signingPublicKey: t.Optional(t.String({ minLength: 40, maxLength: 100 })),
        signingKeyFingerprint: t.Optional(t.String({ minLength: 40, maxLength: 200 })),
        challengeId: t.Optional(t.String({ minLength: 4, maxLength: 64 })),
        challengePoP: t.Optional(t.String({ minLength: 64, maxLength: 200 })),
        platform: t.Optional(t.Union([t.Literal("android"), t.Literal("ios"), t.Literal("other")])),
        pushToken: t.Optional(t.String({ maxLength: 500 })),
      }),
    },
  )
  .post(
    "/token",
    async ({ body }) => {
      const device = await Device.findOne({ deviceId: body.deviceId })
        .select("+apiKeyHash")
        .lean<{ deviceId: string; role: string; apiKeyHash: string } | null>();
      if (!device) throw errors.invalidApiKey();

      const provided = hashApiKey(body.apiKey);
      if (provided !== device.apiKeyHash) throw errors.invalidApiKey();

      const accessToken = await signAccessToken({
        deviceId: device.deviceId,
        role: device.role as "sender" | "receiver",
      });
      await Device.updateOne({ deviceId: device.deviceId }, { $set: { lastSeenAt: new Date() } });

      const result: TokenResult = {
        accessToken,
        tokenType: "Bearer",
        expiresIn: env.accessTokenTtlSeconds,
      };
      return { ok: true as const, data: result };
    },
    {
      detail: { summary: "Exchange deviceId + apiKey for an access token" },
      body: t.Object({
        deviceId: t.String({ minLength: 4 }),
        apiKey: t.String({ minLength: 8 }),
      }),
    },
  );