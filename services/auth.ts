import { randomBytes } from "crypto";

import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/jwt";
import { logAudit } from "@/services/audit";
import { ROLE_LABELS } from "@/constants/permissions";

/**
 * Issues a session: creates a hashed refresh-token record and returns the
 * plain refresh token (the caller sets it as a cookie). Access token is
 * returned too. Caller stores both.
 */
export async function issueSession({
  userId,
  accessToken,
  ipAddress,
  userAgent,
}: {
  userId: string;
  accessToken: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const plainToken = randomBytes(48).toString("base64url");
  await db.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(plainToken),
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN * 1000),
      ipAddress,
      userAgent,
    },
  });
  return { accessToken, refreshToken: plainToken };
}

export async function authenticateUser(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new ApiError(401, "Invalid email or password");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password");
  }

  return user;
}

export async function registerUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const role = await db.role.findUnique({ where: { name: "PATIENT" } });
  if (!role) {
    throw new ApiError(500, "Role configuration missing — run the seed script");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
      phone: input.phone ?? null,
      roleId: role.id,
    },
  });

  return user;
}

export async function revokeSession(refreshToken: string) {
  if (!refreshToken) return;
  await db.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  const hospitalId = user.hospitalId ?? (await defaultHospitalId());
  const key = `passwordReset:${user.id}`;
  const value = JSON.stringify({
    tokenHash: hashToken(token),
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  // Upsert, not create: a repeated request before the previous token is
  // consumed would otherwise hit the unique hospitalId_key constraint → 500.
  await db.settings.upsert({
    where: { hospitalId_key: { hospitalId, key } },
    update: { value },
    create: { hospitalId, key, value },
  });

  return { user, token };
}

async function defaultHospitalId(): Promise<string> {
  const hospital = await db.hospital.findFirst();
  return hospital?.id ?? "000000000000000000000000";
}

export async function resetPassword(token: string, password: string) {
  const tokenHash = hashToken(token);
  const all = await db.settings.findMany({ where: { key: { startsWith: "passwordReset:" } } });

  const match = all.find((s) => {
    try {
      const parsed = JSON.parse(s.value) as { tokenHash: string; expiresAt: number };
      return parsed.tokenHash === tokenHash && parsed.expiresAt > Date.now();
    } catch {
      return false;
    }
  });

  if (!match) throw new ApiError(400, "Invalid or expired reset token");

  const userId = match.key.replace("passwordReset:", "");
  const passwordHash = await hashPassword(password);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, passwordChangedAt: new Date() },
  });
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await db.settings.delete({ where: { id: match.id } });

  return userId;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(400, "Current password is incorrect");

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, passwordChangedAt: new Date() },
  });
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function roleLabelOf(name: string): string {
  return (ROLE_LABELS as Record<string, string>)[name] ?? name;
}

export async function updateLastLogin(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

export async function auditLogin(userId: string, ip?: string, ua?: string) {
  await logAudit({ userId, action: "LOGIN", ipAddress: ip, userAgent: ua });
}