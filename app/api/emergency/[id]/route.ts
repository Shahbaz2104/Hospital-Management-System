import { requirePermission } from "@/lib/auth/guards";
import { ApiError, assertInput, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { listEvents, updateEmergencyCase } from "@/services/emergency";
import { emergencyUpdateSchema } from "@/validators/emergency";

export const GET = route(async (req, ctx) => {
  await requirePermission("emergency:read");
  const { id } = await ctx.params;
  const case_ = await db.emergencyCase.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, gender: true, phone: true } },
      assignedDoctor: { include: { user: { select: { title: true, firstName: true, lastName: true } } } },
      admittedAsAdmission: { select: { admissionNo: true, bed: { select: { number: true } } } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!case_) throw new ApiError(404, "Emergency case not found");
  const events = await listEvents(id);
  return ok({ case: case_, events });
});

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("emergency:manage");
  const { id } = await ctx.params;
  const input = assertInput(emergencyUpdateSchema, await req.json());
  return ok(await updateEmergencyCase(actor, id, input));
});
