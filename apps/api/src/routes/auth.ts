import { Elysia, t } from "elysia";
import { Device } from "../db/models/device.js";
import { audit } from "../db/models/audit.js";
import { signAccessToken, hashApiKey } from "../auth/tokens.js";
import { generateApiKey, newId } from "../utils/ids.js";
import { errors } from "../utils/errors.js";
import { env } from "../config/env.js";
import { isValidPublicKey } from "@simbridge/crypto";
import type { RegisterResult, TokenResult } from "@simbridge/shared";

export const authRoutes = new Elysia({ prefix: "/auth", tags: ["auth"] })
  .post(
    "/register",
    async ({ body, set }) => {
      if (!isValidPublicKey(body.publicKey)) {
        throw errors.validation("publicKey must be a base64-encoded 32-byte X25519 key");
      }
      const apiKey = generateApiKey();
      const deviceId = newId("dev");

      await Device.create({
        deviceId,
        apiKeyHash: hashApiKey(apiKey),
        name: body.name,
        platform: body.platform ?? "android",
        role: body.role,
        publicKey: body.publicKey,
        pushToken: body.pushToken,
        status: "offline",
      });

      const accessToken = await signAccessToken({ deviceId, role: body.role });
      audit("device.registered", { deviceId, meta: { role: body.role, platform: body.platform } });

      const result: RegisterResult = {
        deviceId,
        apiKey, // shown exactly once — the client stores it in the Keystore
        accessToken,
        tokenType: "Bearer",
        expiresIn: env.accessTokenTtlSeconds,
      };
      set.status = 201;
      return { ok: true as const, data: result };
    },
    {
      detail: {
        summary: "Register a device",
        description:
          "Step 1 of the feature flow. The app generates its encryption key pair locally and registers the public key with the backend.",
      },
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 60, error: "name is required (1-60 chars)" }),
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
