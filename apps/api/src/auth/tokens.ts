import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@simbridge/shared";
import { env } from "../config/env.js";

const secretKey = new TextEncoder().encode(env.jwtSecret);

export interface TokenPayload {
  deviceId: string;
  role: Role;
}

/** HS256 access token, subject = deviceId. */
export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.deviceId)
    .setIssuedAt()
    .setIssuer("simbridge")
    .setExpirationTime(env.jwtExpiresIn)
    .sign(secretKey);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secretKey, { issuer: "simbridge" });
  if (!payload.sub) throw new Error("token missing subject");
  return { deviceId: payload.sub, role: (payload.role as Role) ?? "receiver" };
}

/** API keys are stored as SHA-256 hashes only. */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function generateApiKey(): string {
  return `sb_${randomBytes(32).toString("base64url")}`;
}
