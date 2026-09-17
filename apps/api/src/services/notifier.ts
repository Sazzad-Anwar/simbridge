import { logger } from "../utils/logger.js";
import { audit } from "../db/models/audit.js";

export interface PushMessage {
  deviceId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Push notification service.
 *
 * Real-time delivery works over Socket.IO; pushes cover the case where the
 * receiver app is killed. Plug in an FCM/APNs relay by setting
 * `PUSH_SERVICE_URL` (POST { deviceId, title, body, data }). Without it,
 * pushes are logged + audited so local development stays quiet.
 */
export async function sendPush(message: PushMessage): Promise<boolean> {
  const url = process.env.PUSH_SERVICE_URL;
  audit("push.dispatch", { deviceId: message.deviceId, meta: { title: message.title } });
  if (!url) {
    logger.debug("push suppressed (PUSH_SERVICE_URL not set)", { deviceId: message.deviceId });
    return false;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch (err) {
    logger.warn("push dispatch failed", { deviceId: message.deviceId, err: String(err) });
    return false;
  }
}
