import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { insensitiveContains, parseListParams } from "@/lib/pagination";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { createDoctor } from "@/services/master-data";
import { doctorSchema } from "@/validators/master-data";

export const GET = route(async (req: Request) => {
  await requirePermission("doctors:read");

  const url = new URL(req.url);
  const { page, pageSize, search } = parseListParams(url);

  const where = search
    ? {
        OR: [
          { user: insensitiveContains("firstName", search) },
          { user: insensitiveContains("lastName", search) },
          insensitiveContains("specialization", search),
        ],
      }
    : {};

  const [total, doctors] = await Promise.all([
    db.doctor.count({ where }),
    db.doctor.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            title: true,
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
    items: doctors,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("doctors:manage");
  const input = assertInput(doctorSchema, await req.json().catch(() => null));

  const doctor = await createDoctor(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "DOCTOR_CREATED",
    entity: "Doctor",
    entityId: doctor.id,
    meta: { email: input.email },
    ipAddress: getIp(req),
  });
  return ok(doctor, { status: 201 });
});