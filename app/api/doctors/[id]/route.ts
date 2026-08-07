import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { deleteDoctor, updateDoctor } from "@/services/master-data";
import { doctorUpdateSchema } from "@/validators/master-data";

export const PATCH = route(async (req: Request, ctx) => {
  const actor = await requirePermission("doctors:manage");
  const { id } = await ctx.params;
  const input = assertInput(
    doctorUpdateSchema,
    await req.json().catch(() => null)
  );

  const doctor = await updateDoctor(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id,
    input
  );
  await logAudit({
    userId: actor.id,
    action: "DOCTOR_UPDATED",
    entity: "Doctor",
    entityId: id,
    ipAddress: getIp(req),
  });
  return ok(doctor);
});

export const DELETE = route(async (req, ctx) => {
  const actor = await requirePermission("doctors:manage");
  const { id } = await ctx.params;
  await deleteDoctor({ userId: actor.id, hospitalId: actor.hospitalId }, id);
  return ok({ deleted: true });
});