import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ok, route } from "@/lib/http";

export const GET = route(async (req: Request) => {
  await requirePermission("audit:read");

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize")) || 20)
  );
  const action = url.searchParams.get("action")?.trim();
  const entity = url.searchParams.get("entity")?.trim();

  const where = {
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
  };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    items: logs.map((l) => {
      let meta: unknown = null;
      if (l.meta) {
        try {
          meta = JSON.parse(l.meta);
        } catch {
          meta = null;
        }
      }
      return {
        id: l.id,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        meta,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        createdAt: l.createdAt,
        actor: l.user
          ? `${l.user.firstName} ${l.user.lastName} (${l.user.email})`
          : null,
      };
    }),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});