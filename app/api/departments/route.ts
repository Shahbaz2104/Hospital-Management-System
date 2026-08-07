import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { insensitiveContains, parseListParams } from "@/lib/pagination";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { createDepartment } from "@/services/master-data";
import { departmentSchema } from "@/validators/master-data";

export const GET = route(async (req: Request) => {
  await requirePermission("departments:read");

  const url = new URL(req.url);
  const { page, pageSize, search } = parseListParams(url);

  const where = search
    ? { OR: [insensitiveContains("name", search), insensitiveContains("code", search)] }
    : {};

  const [total, departments] = await Promise.all([
    db.department.count({ where }),
    db.department.findMany({
      where,
      include: {
        headDoctor: { include: { user: true } },
        _count: { select: { doctors: true, nurses: true, rooms: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    items: departments,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("departments:manage");
  const input = assertInput(departmentSchema, await req.json().catch(() => null));

  const dept = await createDepartment(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "DEPARTMENT_CREATED",
    entity: "Department",
    entityId: dept.id,
    meta: { name: dept.name, code: dept.code },
    ipAddress: getIp(req),
  });
  return ok(dept, { status: 201 });
});