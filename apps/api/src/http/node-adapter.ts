/**
 * Node HTTP adapter.
 *
 * Elysia is Bun-first; on Node.js we mount the Elysia app as a fetch-style
 * request handler on a plain `node:http` server. Socket.IO attaches to the
 * SAME server, so REST + WebSocket share one port and TLS termination.
 */
import http from "node:http";
import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http";
import type { Elysia as ElysiaInstance } from "elysia";
import { logger } from "../utils/logger.js";

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-length",
]);

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function toElysiaRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? `localhost`;
  const url = new URL(req.url ?? "/", `http://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (key === "x-forwarded-for") continue; // re-set below from socket
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, String(value));
  }
  if (!headers.has("x-forwarded-for") && req.socket?.remoteAddress) {
    headers.set("x-forwarded-for", req.socket.remoteAddress);
  }

  const method = (req.method ?? "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await readBody(req) : undefined;

  return new Request(url.toString(), {
    method,
    headers,
    body: body && body.length > 0 ? new Uint8Array(body) : undefined,
  });
}

async function writeElysiaResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key === "set-cookie") return;
    if (HOP_BY_HOP.has(key)) return;
    res.setHeader(key, value);
  });
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);

  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

/** Structural view of the Elysia app — the adapter only needs fetch-style handle(). */
export interface FetchHandler {
  handle(request: Request): Promise<Response> | Response;
}

export function createHttpServer(app: FetchHandler): HttpServer {
  const server = http.createServer((req, res) => {
    toElysiaRequest(req)
      .then((request) => app.handle(request))
      .then((response) => writeElysiaResponse(res, response))
      .catch((err) => {
        logger.error("http pipeline error", { err: String(err), url: req.url });
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
        }
        res.end(
          JSON.stringify({
            ok: false,
            error: { code: "INTERNAL", message: "Internal server error" },
          }),
        );
      });
  });
  // Long-lived WebSocket connections must not time out like normal requests.
  server.requestTimeout = 0;
  server.headersTimeout = 60_000;
  return server;
}
