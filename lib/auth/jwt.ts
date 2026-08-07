import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

import { env } from "@/lib/env";

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export type AccessTokenPayload = {
  sub: string;
  role: string;
  type: "access";
};

export async function signAccessToken(
  userId: string,
  roleName: string
): Promise<string> {
  return new SignJWT({ type: "access", role: roleName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.JWT_ACCESS_EXPIRES_IN)
    .sign(accessKey);
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey);
    return {
      sub: String(payload.sub),
      role: String(payload.role),
      type: "access",
    } as AccessTokenPayload;
  } catch {
    return null;
  }
}

/** Opaque refresh token value (random, not a JWT). */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const REFRESH_TOKEN_COOKIE = "hms_refresh";
export const ACCESS_TOKEN_COOKIE = "hms_access";