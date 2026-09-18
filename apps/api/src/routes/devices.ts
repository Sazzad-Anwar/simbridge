import { Elysia, t } from "elysia";
import { authGuard } from "../auth/guard.js";
import { Device } from "../db/models/device.js";
import { SimSubscription } from "../db/models/sim.js";
import { toDeviceDTO } from "../services/pairing.js";
import { errors } from "../utils/errors.js";
import { isValidPhoneNumber, normalizePhoneNumber } from "@simbridge/shared";
import type { DeviceDTO, SimInfo } from "@simbridge/shared";

const SimBody = t.Object({
  subscriptionId: t.Number({ minimum: 0 }),
  carrierName: t.Optional(t.String({ maxLength: 120 })),
  slotIndex: t.Optional(t.Number({ minimum: 0, maximum: 7 })),
  displayName: t.Optional(t.String({ maxLength: 120 })),
  phoneNumber: t.Optional(t.String({ maxLength: 40 })),
  isActive: t.Optional(t.Boolean()),
});

async function simsOf(deviceId: string): Promise<SimInfo[]> {
  const sims = await SimSubscription.find({ deviceId })
    .sort({ slotIndex: 1, subscriptionId: 1 })
    .lean<Array<SimInfo & { deviceId: string; _id: unknown }>>();
  return sims.map((s) => ({
    subscriptionId: s.subscriptionId,
    carrierName: s.carrierName ?? "",
    slotIndex: s.slotIndex ?? 0,
    displayName: s.displayName ?? s.carrierName ?? `SIM ${s.subscriptionId}`,
    phoneNumber: s.phoneNumber,
    isActive: s.isActive ?? true,
  }));
}

async function deviceWithSims(deviceId: string): Promise<DeviceDTO> {
  const device = await Device.findOne({ deviceId }).lean();
  if (!device) throw new Error("device disappeared");
  return toDeviceDTO(device, await simsOf(deviceId));
}

export const deviceRoutes = new Elysia({ prefix: "/me", tags: ["devices"] })
  .use(authGuard)
  .get(
    "/",
    async ({ auth }) => ({ ok: true as const, data: await deviceWithSims(auth.deviceId) }),
    { detail: { summary: "Get the current device profile (with SIM registry)" } },
  )
  .patch(
    "/",
    async ({ auth, body }) => {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) {
        const name = normalizePhoneNumber(body.name);
        if (!isValidPhoneNumber(name)) {
          throw errors.validation("name must be a phone number (e.g. +15551234567)");
        }
        const taken = await Device.findOne({
          name,
          deviceId: { $ne: auth.deviceId },
        })
          .select("_id")
          .lean();
        if (taken) throw errors.duplicate();
        patch.name = name;
      }
      if (body.pushToken !== undefined) patch.pushToken = body.pushToken;

      await Device.updateOne({ deviceId: auth.deviceId }, { $set: patch });
      return { ok: true as const, data: await deviceWithSims(auth.deviceId) };
    },
    {
      detail: { summary: "Update device profile (name = phone number, push token)" },
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 30 })),
        pushToken: t.Optional(t.String({ maxLength: 500 })),
      }),
    },
  )
  .get(
    "/sims",
    async ({ auth }) => ({ ok: true as const, data: await simsOf(auth.deviceId) }),
    { detail: { summary: "List registered SIM subscriptions" } },
  )
  .put(
    "/sims",
    async ({ auth, body }) => {
      if (body.sims.length > 8) {
        throw errors.validation("At most 8 SIMs per device");
      }
      // Replace-all semantics for the SIM subscription registry.
      await SimSubscription.deleteMany({ deviceId: auth.deviceId });
      if (body.sims.length > 0) {
        await SimSubscription.insertMany(
          body.sims.map((s) => ({
            deviceId: auth.deviceId,
            subscriptionId: s.subscriptionId,
            carrierName: s.carrierName ?? "",
            slotIndex: s.slotIndex ?? 0,
            displayName: s.displayName ?? s.carrierName ?? `SIM ${s.subscriptionId}`,
            phoneNumber: s.phoneNumber,
            isActive: s.isActive ?? true,
          })),
        );
      }
      return { ok: true as const, data: await simsOf(auth.deviceId) };
    },
    {
      detail: {
        summary: "Replace the SIM subscription registry for this device",
        description: "Sent by the sender app whenever the SIM/SubscriptionManager reports a change.",
      },
      body: t.Object({ sims: t.Array(SimBody, { maxItems: 8 }) }),
    },
  );
