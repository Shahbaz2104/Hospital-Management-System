import { cookies } from "next/headers";

import type { PermissionKey } from "@/constants/permissions";
import { hasPermission } from "@/constants/permissions";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from "@/lib/auth/jwt";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  title?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  roleId: string;
  roleName: string;
  roleLabel: string;
  hospitalId?: string | null;
  permissions: PermissionKey[];
};

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setSessionCookies(
  userId: string,
  roleName: string
): Promise<string> {
  const accessToken = await signAccessToken(userId, roleName);
  const refreshToken = generateRefreshToken();
  const store = await cookies();

  store.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieBase,
    maxAge: env.JWT_ACCESS_EXPIRES_IN,
  });
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieBase,
    maxAge: env.JWT_REFRESH_EXPIRES_IN,
  });

  return hashToken(refreshToken);
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, "", { ...cookieBase, maxAge: 0 });
  store.set(REFRESH_TOKEN_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

async function loadUserWithPermissions(userId: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: { rolePermissions: { include: { permission: true } } },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") return null;

  const keys = user.role ? user.role.rolePermissions.map((rp) => rp.permission.key) : [];

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    title: user.title,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    roleId: user.roleId,
    roleName: user.role?.name ?? "UNASSIGNED",
    roleLabel: user.role?.label ?? "Unassigned",
    hospitalId: user.hospitalId,
    permissions: keys as PermissionKey[],
  };
}

/**
 * Read-only session resolution. Safe to call from Server Components and
 * Route Handlers — never modifies cookies. Token rotation happens in
 * `rotateSession()` (Route Handlers / Server Actions only).
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload?.sub) {
      const user = await loadUserWithPermissions(payload.sub);
      if (user) return user;
    }
  }

  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    const record = await db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true } } },
    });

    if (
      record &&
      !record.revokedAt &&
      record.expiresAt.getTime() > Date.now() &&
      record.user.status === "ACTIVE"
    ) {
      return loadUserWithPermissions(record.userId);
    }
  }

  return null;
}

/**
 * Validates the refresh token, rotates it and writes new session cookies.
 * Only callable from Route Handlers or Server Actions.
 */
export async function rotateSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) return null;

  const tokenHash = hashToken(refreshToken);
  const record = await db.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });

  if (
    !record ||
    record.revokedAt ||
    record.expiresAt.getTime() <= Date.now() ||
    record.user.status !== "ACTIVE"
  ) {
    if (record) {
      await clearSessionCookies();
    }
    return null;
  }

  const access = await signAccessToken(record.userId, record.user.role.name);
  const nextRefresh = generateRefreshToken();
  const nextHash = hashToken(nextRefresh);

  await db.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date(), replacedByToken: nextHash },
  });
  await db.refreshToken.create({
    data: {
      userId: record.userId,
      tokenHash: nextHash,
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN * 1000),
      userAgent: record.userAgent,
      ipAddress: record.ipAddress,
    },
  });

  store.set(ACCESS_TOKEN_COOKIE, access, {
    ...cookieBase,
    maxAge: env.JWT_ACCESS_EXPIRES_IN,
  });
  store.set(REFRESH_TOKEN_COOKIE, nextRefresh, {
    ...cookieBase,
    maxAge: env.JWT_REFRESH_EXPIRES_IN,
  });

  return loadUserWithPermissions(record.userId);
}

export function can(user: SessionUser, permission: PermissionKey): boolean {
  return hasPermission(user.permissions, permission);
}