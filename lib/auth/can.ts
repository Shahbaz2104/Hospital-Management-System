import type { PermissionKey } from "@/constants/permissions";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Pure permission check — safe for client components.
 * `permissions` may contain the "*" wildcard for super admins.
 */
export function can(user: Pick<SessionUser, "permissions">, permission: PermissionKey): boolean {
  return (
    user.permissions.includes("*" as PermissionKey) ||
    user.permissions.includes(permission)
  );
}