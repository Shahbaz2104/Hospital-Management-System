import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ApiError, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import {
  deleteAdmission,
  dischargeAdmission,
  transferAdmission,
} from "@/services/admissions";
import { transferSchema } from "@/validators/admissions";

export const GET = route(async (req, ctx) => {
  await requirePermission("admissions:read");
  const { id } = await ctx.params;

  const admission = await db.admission.findUnique({
    where: { id },
    include: {
      patient: true,
      bed: { include: { room: true } },
      doctor: { include: { user: true } },
    },
  });
  if (!admission) throw new ApiError(404, "Admission not found");
  return ok(admission);
});

export const PATCH = route(async (req: Request, ctx) => {
  const actor = await requirePermission("admissions:manage");
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  if (body && typeof body === "object" && "bedId" in body) {
    const input = assertInput(transferSchema, body);
    await transferAdmission(
      { userId: actor.id, hospitalId: actor.hospitalId },
      id,
      input.bedId
    );
    await logAudit({
      userId: actor.id,
      action: "PATIENT_TRANSFERRED",
      entity: "Admission",
      entityId: id,
      ipAddress: getIp(req),
    });
    return ok({ transferred: true });
  }

  if (body && typeof body === "object" && body.action === "discharge") {
    await dischargeAdmission(
      { userId: actor.id, hospitalId: actor.hospitalId },
      id
    );
    await logAudit({
      userId: actor.id,
      action: "PATIENT_DISCHARGED",
      entity: "Admission",
      entityId: id,
      ipAddress: getIp(req),
    });
    return ok({ discharged: true });
  }

  throw new ApiError(400, "Unsupported operation");
});

export const DELETE = route(async (req, ctx) => {
  const actor = await requirePermission("admissions:manage");
  const { id } = await ctx.params;
  await deleteAdmission(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id
  );
  return ok({ deleted: true });
});
