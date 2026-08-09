import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ok, route } from "@/lib/http";

export const GET = route(async () => {
  await requirePermission("users:read");
  const permissions = await db.permission.findMany({ orderBy: { module: "asc" } });
  return ok({
    items: permissions.map((p) => ({
      key: p.key,
      label: p.label,
      module: p.module,
    })),
  });
});