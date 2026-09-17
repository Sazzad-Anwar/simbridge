import { Elysia } from "elysia";
import { Device } from "../db/models/device.js";
import { Pair } from "../db/models/pair.js";
import { Message } from "../db/models/message.js";
import { mongoState } from "../db/mongo.js";
import { env } from "../config/env.js";
import { tryGetIo, onlineDeviceCount } from "../realtime/io.js";
import { authGuard } from "../auth/guard.js";
import type { StatsResult } from "@simbridge/shared";

const startedAt = Date.now();

// Tiny cache so the status page doesn't hammer MongoDB on refreshes.
let cache: { at: number; counts: { devices: number; pairs: number; activePairs: number; messages: number; messagesDelivered: number } } | null = null;

async function counts() {
  if (cache && Date.now() - cache.at < 5_000) return cache.counts;
  const [devices, pairs, activePairs, messages, messagesDelivered] = await Promise.all([
    Device.countDocuments(),
    Pair.countDocuments(),
    Pair.countDocuments({ status: "active" }),
    Message.countDocuments(),
    Message.countDocuments({ status: "delivered" }),
  ]);
  const c = { devices, pairs, activePairs, messages, messagesDelivered };
  cache = { at: Date.now(), counts: c };
  return c;
}

function renderStatusPage(s: {
  mongo: string;
  onlineDevices: number;
  sockets: number;
  uptimeSeconds: number;
  counts: { devices: number; pairs: number; activePairs: number; messages: number; messagesDelivered: number };
}): string {
  const badge = (label: string, ok = true) =>
    `<span class="badge ${ok ? "ok" : "warn"}">${ok ? "●" : "○"} ${label}</span>`;

  const stat = (label: string, value: string | number) =>
    `<div class="stat"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SIMBridge — API Status</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background: radial-gradient(1200px 800px at 80% -10%, #2b1d5e 0%, #131322 55%, #0d0d17 100%);
         color: #e7e7f2; min-height: 100vh; padding: 40px 24px; }
  .wrap { max-width: 960px; margin: 0 auto; }
  header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .logo { width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center;
          background: linear-gradient(135deg, #7c5cff, #4f8cff); font-size: 26px; }
  h1 { font-size: 28px; letter-spacing: -0.5px; }
  .tagline { color: #9a9ab8; margin-top: 4px; font-size: 14px; }
  .badges { display: flex; gap: 8px; flex-wrap: wrap; margin: 20px 0 28px; }
  .badge { font-size: 12px; padding: 6px 12px; border-radius: 999px; border: 1px solid #33335a;
           background: #1b1b30; color: #b9b9d9; }
  .badge.ok { color: #7ef0b2; border-color: #23543e; }
  .badge.warn { color: #f0c67e; border-color: #5c4a23; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
  .stat { background: #16162a; border: 1px solid #26264a; border-radius: 16px; padding: 18px; }
  .stat-value { font-size: 28px; font-weight: 700; color: #b7a8ff; }
  .stat-label { font-size: 12px; color: #8b8bad; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 28px; }
  .card { background: #16162a; border: 1px solid #26264a; border-radius: 16px; padding: 20px; }
  .card h3 { font-size: 14px; margin-bottom: 12px; color: #cfcfee; }
  .card p, .card li { font-size: 13px; color: #9a9ab8; line-height: 1.6; }
  .card ul { padding-left: 18px; }
  a { color: #9f8dff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: #101020; border: 1px solid #26264a; padding: 2px 6px; border-radius: 6px; font-size: 12px; }
  footer { margin-top: 36px; color: #6d6d90; font-size: 12px; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">🔗</div>
    <div>
      <h1>SIMBridge API</h1>
      <div class="tagline">Your SIM. Your messages. Anywhere. — Elysia.js + Socket.IO + MongoDB</div>
    </div>
  </header>

  <div class="badges">
    ${badge("End-to-End Encrypted")}
    ${badge("Real-time (Socket.IO)")}
    ${badge("Offline Resilient")}
    ${badge("Local MongoDB: " + s.mongo, s.mongo === "connected")}
    ${badge("v" + env.version)}
  </div>

  <div class="grid">
    ${stat("Devices", s.counts.devices)}
    ${stat("Pairs (active)", s.counts.activePairs + " / " + s.counts.pairs)}
    ${stat("Messages", s.counts.messages)}
    ${stat("Delivered", s.counts.messagesDelivered)}
    ${stat("Online devices", s.onlineDevices)}
    ${stat("WS clients", s.sockets)}
  </div>

  <div class="cards">
    <div class="card">
      <h3>Explore the API</h3>
      <ul>
        <li>Swagger UI: <a href="/docs">/docs</a></li>
        <li>Health JSON: <a href="/health">/health</a></li>
        <li>Socket.IO endpoint: <code>ws://host/socket.io</code> (JWT in <code>auth.token</code>)</li>
      </ul>
    </div>
    <div class="card">
      <h3>Privacy model</h3>
      <p>The backend never sees plaintext messages. Senders encrypt with the receiver's public key (X25519 + XSalsa20-Poly1305); only the receiver's private key can decrypt. Messages are stored encrypted-only, with automatic TTL cleanup.</p>
    </div>
    <div class="card">
      <h3>Flows implemented</h3>
      <p>① Device registration → ② Role selection → ③ Pairing request → ④ SMS received → ⑤ Offline handling → ⑥ Real-time delivery → ⑦ Message sync</p>
    </div>
  </div>

  <footer>Uptime ${Math.floor(s.uptimeSeconds / 60)}m ${Math.floor(s.uptimeSeconds % 60)}s · SIMBridge API v${env.version}</footer>
</div>
</body>
</html>`;
}

export const statusRoutes = new Elysia()
  .get(
    "/",
    async () => {
      const c = await counts().catch(() => ({
        devices: 0,
        pairs: 0,
        activePairs: 0,
        messages: 0,
        messagesDelivered: 0,
      }));
      const html = renderStatusPage({
        mongo: mongoState(),
        onlineDevices: onlineDeviceCount(),
        sockets: tryGetIo()?.engine.clientsCount ?? 0,
        uptimeSeconds: (Date.now() - startedAt) / 1000,
        counts: c,
      });
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    },
    { detail: { summary: "Status dashboard (HTML)", tags: ["meta"] } },
  )
  .get(
    "/health",
    () => ({
      ok: true,
      data: {
        status: mongoState() === "connected" ? "healthy" : "degraded",
        mongo: mongoState(),
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        version: env.version,
        time: new Date().toISOString(),
      },
    }),
    { detail: { summary: "Health check", tags: ["meta"] } },
  )
  .use(authGuard)
  .get(
    "/stats",
    async () => {
      const c = await counts();
      const data: StatsResult = {
        ...c,
        onlineDevices: onlineDeviceCount(),
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        mongo: mongoState(),
        version: env.version,
      };
      return { ok: true as const, data };
    },
    { detail: { summary: "System statistics (auth)", tags: ["meta"] } },
  );
