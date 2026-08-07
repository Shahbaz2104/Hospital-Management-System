import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ApiError, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { deleteAppointment, setAppointmentStatus } from "@/services/clinical";
import { appointmentStatusSchema } from "@/validators/clinical";

export const GET = route(async (req, ctx) => {
  await requirePermission("appointments:read");
  const { id } = await ctx.params;

  const appointment = await db.appointment.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { include: { user: true } },
      department: true,
    },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found");
  return ok(appointment);
});

export const PATCH = route(async (req: Request, ctx) => {
  const actor = await requirePermission("appointments:update");
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const input = assertInput(appointmentStatusSchema, body);

  const appointment = await setAppointmentStatus(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id,
    input.status
  );
  await logAudit({
    userId: actor.id,
    action: "APPOINTMENT_STATUS_CHANGED",
    entity: "Appointment",
    entityId: id,
    meta: { status: input.status },
    ipAddress: getIp(req),
  });
  return ok(appointment);
});

export const DELETE = route(async (req, ctx) => {
  const actor = await requirePermission("appointments:delete");
  const { id } = await ctx.params;
  await deleteAppointment({ userId: actor.id, hospitalId: actor.hospitalId }, id);
  return ok({ deleted: true });
});