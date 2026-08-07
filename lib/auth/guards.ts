import { NextResponse } from "next/server";

import type { PermissionKey } from "@/constants/permissions";
import { can } from "@/lib/auth/can";
import type { SessionUser } from "@/lib/auth/session";
import { getSession } from "@/lib/auth/session";
import { ApiError } from "@/lib/http";

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new ApiError(401, "Unauthorized");
  return user;
}

export async function requirePermission(
  permission: PermissionKey
): Promise<SessionUser> {
  const user = await requireSession();
  if (!can(user, permission)) {
    throw new ApiError(403, "You don't have permission to perform this action");
  }
  return user;
}

export { can };

export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 }
  );
}