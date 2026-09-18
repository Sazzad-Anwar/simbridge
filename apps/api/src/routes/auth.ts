import { Elysia, t } from "elysia";
import type { Role } from "@simbridge/shared";
import { Device } from "../db/models/device.js";
import { audit } from "../db/models/audit.js";
import { signAccessToken, hashApiKey } from "../auth/tokens.js";
import { generateApiKey, newId } from "../utils/ids.js";
import { errors } from "../utils/errors.js";
import { env } from "../config/env.js";
import { isValidPublicKey } from "@simbridge/crypto";
import { isValidPhoneNumber, normalizePhoneNumber } from "@simbridge/shared";
import type { RegisterResult, TokenResult } from "@simbridge/shared";

async function reclaimDevice(
  deviceId: string,
  role: Role,
  patch: { publicKey: string; platform: string; pushToken?: string },
): Promise<RegisterResult> {
  const apiKey = generateApiKey();
  await Device.updateOne(
    { deviceId },
    {
      $set: {
        apiKeyHash: hashApiKey(apiKey),
        publicKey: patch.publicKey,
        platform: patch.platform,
        ...(patch.pushToken ? { pushToken: patch.pushToken } : {}),
        lastSeenAt: new Date(),
      },
    },
  );
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

export const authRoutes = new Elysia({ prefix: "/auth", tags: ["auth"] })
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

      const devicePatch = {
        publicKey: body.publicKey,
        platform: body.platform ?? "android",
        pushToken: body.pushToken,
      };

      const existing = await Device.findOne({ name })
        .select("deviceId role")
        .lean<{ deviceId: string; role: Role } | null>();
      if (existing) {
        const result = await reclaimDevice(existing.deviceId, existing.role, devicePatch);
        audit("device.reclaimed", { deviceId: existing.deviceId, meta: { role: existing.role } });
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
      audit("device.registered", { deviceId, meta: { role: body.role, platform: body.platform } });

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
          "Step 1 of the feature flow. The app generates its encryption key pair locally and registers the public key with the backend. The device name is its phone number and is unique. Registering an already-registered number reclaims that device (idempotent after a local data wipe) instead of erroring.",
      },
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 30, error: "name is required (a phone number)" }),
        role: t.Union([t.Literal("sender"), t.Literal("receiver")]),
        publicKey: t.String({ minLength: 40, maxLength: 100 }),
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
