import { Elysia, t } from "elysia";
import { authGuard } from "../auth/guard.js";
import {
  createPair,
  acceptPair,
  revokePair,
  listPairs,
  confirmPairFingerprint,
} from "../services/pairing.js";
import { errors } from "../utils/errors.js";

export const pairRoutes = new Elysia({ prefix: "/pairs", tags: ["pairing"] })
  .use(authGuard)
  .get(
    "/",
    async ({ auth }) => ({ ok: true as const, data: await listPairs(auth.deviceId) }),
    { detail: { summary: "List pairs for this device" } },
  )
  .post(
    "/",
    async ({ auth, body, set }) => {
      const result = await createPair(
        { deviceId: auth.deviceId, role: auth.role, name: auth.device.name },
        body,
      );
      set.status = 201;
      return { ok: true as const, data: result };
    },
    {
      detail: {
        summary: "Create a pairing request (sender)",
        description:
          "Step 3 of the feature flow. The receiver gets a Socket.IO event and/or push notification with the 6-digit code.",
      },
      body: t.Object({
        receiverDeviceId: t.Optional(t.String({ minLength: 4 })),
        receiverPhoneNumber: t.Optional(t.String({ minLength: 3, maxLength: 40 })),
      }),
    },
  )
  .post(
    "/accept/:code",
    async ({ auth, params }) => {
      const result = await acceptPair(
        { deviceId: auth.deviceId, role: auth.role, name: auth.device.name },
        params.code,
      );
      return { ok: true as const, data: result };
    },
    {
      detail: { summary: "Accept a pairing request with the 6-digit code (receiver)" },
      params: t.Object({ code: t.String({ minLength: 4, maxLength: 10 }) }),
    },
  )
  .post(
    "/:pairId/confirm",
    async ({ auth, params }) => {
      const result = await confirmPairFingerprint(
        { deviceId: auth.deviceId, role: auth.role },
        params.pairId,
      );
      return { ok: true as const, data: result };
    },
    {
      detail: {
        summary: "Record that I verified the other device's fingerprint",
        description:
          "The caller has visually compared and confirmed the peer's identity fingerprint. Enables V1 signed-envelope messaging once both sides confirm.",
      },
      params: t.Object({ pairId: t.String({ minLength: 4 }) }),
    },
  )
  .get(
    "/:pairId",
    async ({ auth, params }) => {
      const pairs = await listPairs(auth.deviceId);
      const pair = pairs.find((p) => p.pairId === params.pairId);
      if (!pair) throw errors.pairNotFound();
      return { ok: true as const, data: pair };
    },
    { detail: { summary: "Get a single pair" } },
  )
  .delete(
    "/:pairId",
    async ({ auth, params }) => {
      await revokePair({ deviceId: auth.deviceId }, params.pairId);
      return { ok: true as const, data: { revoked: true, pairId: params.pairId } };
    },
    { detail: { summary: "Revoke a pair (either participant)" } },
  );
