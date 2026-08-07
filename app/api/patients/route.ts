import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { insensitiveContains, parseListParams } from "@/lib/pagination";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { createPatient } from "@/services/clinical";
import { patientSchema } from "@/validators/clinical";

export const GET = route(async (req: Request) => {
  await requirePermission("patients:read");

  const url = new URL(req.url);
  const { page, pageSize, search } = parseListParams(url);

  const where = search
    ? {
        OR: [
          insensitiveContains("firstName", search),
          insensitiveContains("lastName", search),
          insensitiveContains("patientNo", search),
          insensitiveContains("phone", search),
        ],
      }
    : {};

  const [total, patients] = await Promise.all([
    db.patient.count({ where }),
    db.patient.findMany({
      where,
      include: { _count: { select: { appointments: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    items: patients,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("patients:create");
  const input = assertInput(patientSchema, await req.json().catch(() => null));

  const patient = await createPatient(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "PATIENT_CREATED",
    entity: "Patient",
    entityId: patient.id,
    meta: { patientNo: patient.patientNo },
    ipAddress: getIp(req),
  });
  return ok(patient, { status: 201 });
});