import { Elysia, t } from "elysia";
import { authGuard } from "../auth/guard.js";
import { Device } from "../db/models/device.js";
import { SimSubscription } from "../db/models/sim.js";
import { toDeviceDTO } from "../services/pairing.js";
import { errors } from "../utils/errors.js";
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
      await Device.updateOne(
        { deviceId: auth.deviceId },
        {
          $set: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.pushToken !== undefined ? { pushToken: body.pushToken } : {}),
          },
        },
      );
      return { ok: true as const, data: await deviceWithSims(auth.deviceId) };
    },
    {
      detail: { summary: "Update device profile (name, push token)" },
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 60 })),
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
