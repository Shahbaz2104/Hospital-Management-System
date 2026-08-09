import { requirePermission } from "@/lib/auth/guards";
import { assertPatientScope, getPatientScope } from "@/lib/auth/scoping";
import { assertInput, ApiError, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { deletePatient, updatePatient } from "@/services/clinical";
import { patientSchema } from "@/validators/clinical";

export const GET = route(async (req, ctx) => {
  const actor = await requirePermission("patients:read");
  const { id } = await ctx.params;

  assertPatientScope(actor, id, await getPatientScope(actor));

  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      appointments: {
        include: { doctor: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { date: "desc" },
      },
    },
  });
  if (!patient) throw new ApiError(404, "Patient not found");
  return ok(patient);
});

export const PATCH = route(async (req: Request, ctx) => {
  const actor = await requirePermission("patients:update");
  const { id } = await ctx.params;
  const input = assertInput(patientSchema.partial(), await req.json().catch(() => null));

  const patient = await updatePatient(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id,
    input
  );
  await logAudit({
    userId: actor.id,
    action: "PATIENT_UPDATED",
    entity: "Patient",
    entityId: id,
    ipAddress: getIp(req),
  });
  return ok(patient);
});

export const DELETE = route(async (req, ctx) => {
  const actor = await requirePermission("patients:delete");
  const { id } = await ctx.params;
  await deletePatient({ userId: actor.id, hospitalId: actor.hospitalId }, id);
  return ok({ deleted: true });
});