import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ok, route } from "@/lib/http";

export const GET = route(async () => {
  await requireSession();
  const roles = await db.role.findMany({
    include: { rolePermissions: { include: { permission: true } } },
    orderBy: { label: "asc" },
  });

  return ok({
    items: roles.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.rolePermissions.map((rp) => rp.permission.key),
    })),
  });
});