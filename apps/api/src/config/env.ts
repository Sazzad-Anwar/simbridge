/**
 * Environment configuration with a tiny dependency-free .env loader.
 * Precedence: real process.env > apps/api/.env > defaults.
 */
import fs from "node:fs";
import path from "node:path";

function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadDotEnv(path.join(process.cwd(), ".env"));
loadDotEnv(path.join(process.cwd(), "../../.env"));

const str = (key: string, fallback: string): string => {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : fallback;
};

const num = (key: string, fallback: number): number => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const env = {
  port: num("PORT", 3000),
  host: str("HOST", "0.0.0.0"),
  mongoUri: str("MONGO_URI", "mongodb://127.0.0.1:27017/simbridge"),
  jwtSecret: str("JWT_SECRET", "simbridge-dev-secret-change-me-in-production"),
  jwtExpiresIn: str("JWT_EXPIRES_IN", "30d"),
  accessTokenTtlSeconds: 60 * 60 * 24 * 30,
  pairingCodeTtlMinutes: num("PAIRING_CODE_TTL_MINUTES", 10),
  challengeTtlSeconds: num("CHALLENGE_TTL_SECONDS", 300),
  messageTtlDays: num("MESSAGE_TTL_DAYS", 7),
  auditTtlDays: num("AUDIT_TTL_DAYS", 30),
  rateLimitWindowMs: num("RATE_LIMIT_WINDOW_MS", 60_000),
  rateLimitMax: num("RATE_LIMIT_MAX", 240),
  corsOrigin: str("CORS_ORIGIN", "*"),
  logLevel: str("LOG_LEVEL", "info"),
  version: "0.1.0",
  isProd: process.env.NODE_ENV === "production",
} as const;
