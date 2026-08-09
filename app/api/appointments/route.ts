import { requirePermission } from "@/lib/auth/guards";
import { getPatientScope } from "@/lib/auth/scoping";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { parseListParams } from "@/lib/pagination";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { createAppointment } from "@/services/clinical";
import { appointmentSchema } from "@/validators/clinical";

export const GET = route(async (req: Request) => {
  const actor = await requirePermission("appointments:read");

  const url = new URL(req.url);
  const { page, pageSize, search } = parseListParams(url);
  const doctorId = url.searchParams.get("doctorId") ?? undefined;
  const departmentId = url.searchParams.get("departmentId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const date = url.searchParams.get("date") ?? undefined;

  // PATIENT actors can only see their own appointments (IDOR guard).
  const scopedPatientId = await getPatientScope(actor);

  const where: Record<string, unknown> = {};
  if (scopedPatientId) where.patientId = scopedPatientId;
  if (search) {
    where.OR = [
      { tokenNo: { contains: search, mode: "insensitive" } },
      { patient: { firstName: { contains: search, mode: "insensitive" } } },
      { patient: { lastName: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (doctorId) where.doctorId = doctorId;
  if (departmentId) where.departmentId = departmentId;
  if (status) where.status = status;
  if (date) where.date = new Date(`${date}T00:00:00`);

  const [total, appointments] = await Promise.all([
    db.appointment.count({ where }),
    db.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            patientNo: true,
            firstName: true,
            lastName: true,
            phone: true,
            gender: true,
          },
        },
        doctor: {
          include: { user: { select: { firstName: true, lastName: true, title: true } } },
        },
        department: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    items: appointments,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("appointments:create");
  const input = assertInput(appointmentSchema, await req.json().catch(() => null));

  const appointment = await createAppointment(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "APPOINTMENT_CREATED",
    entity: "Appointment",
    entityId: appointment.id,
    meta: { tokenNo: appointment.tokenNo },
    ipAddress: getIp(req),
  });
  return ok(appointment, { status: 201 });
});