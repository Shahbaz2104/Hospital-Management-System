import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { insensitiveContains, parseListParams } from "@/lib/pagination";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { createNurse } from "@/services/master-data";
import { nurseSchema } from "@/validators/master-data";

export const GET = route(async (req: Request) => {
  await requirePermission("nurses:read");

  const url = new URL(req.url);
  const { page, pageSize, search } = parseListParams(url);

  const where = search
    ? {
        OR: [
          { user: insensitiveContains("firstName", search) },
          { user: insensitiveContains("lastName", search) },
          insensitiveContains("ward", search),
        ],
      }
    : {};

  const [total, nurses] = await Promise.all([
    db.nurse.count({ where }),
    db.nurse.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
          },
        },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    items: nurses,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("nurses:manage");
  const input = assertInput(nurseSchema, await req.json().catch(() => null));

  const nurse = await createNurse(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "NURSE_CREATED",
    entity: "Nurse",
    entityId: nurse.id,
    meta: { email: input.email },
    ipAddress: getIp(req),
  });
  return ok(nurse, { status: 201 });
});