import { Elysia } from "elysia";
import type { DeviceDoc } from "../db/models/device.js";
import { Device } from "../db/models/device.js";
import { verifyAccessToken } from "./tokens.js";
import { errors } from "../utils/errors.js";

export interface AuthContext {
  deviceId: string;
  role: DeviceDoc["role"];
  device: DeviceDoc;
}

/**
 * Bearer-token auth guard. Mount with `.use(authGuard)` inside a route
 * plugin — every route defined afterwards in that plugin is protected
 * and receives the typed `auth` context (async context via `resolve`).
 */
export const authGuard = new Elysia({ name: "guard.auth" }).resolve(
  { as: "scoped" },
  async ({ headers }): Promise<{ auth: AuthContext }> => {
    const header = headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw errors.authRequired();

    let deviceId: string;
    try {
      const payload = await verifyAccessToken(token);
      deviceId = payload.deviceId;
    } catch {
      throw errors.invalidToken();
    }

    const device = await Device.findOne({ deviceId }).lean<DeviceDoc>();
    if (!device) throw errors.deviceNotFound();

    return { auth: { deviceId: device.deviceId, role: device.role, device } };
  },
);
