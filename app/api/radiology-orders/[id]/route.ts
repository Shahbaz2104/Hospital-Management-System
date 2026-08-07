import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ApiError, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import {
  submitRadiologyReport,
  updateRadiologyOrderStatus,
} from "@/services/diagnostics";
import { radiologyResultSchema } from "@/validators/diagnostics";

export const GET = route(async (req, ctx) => {
  await requirePermission("radiology:read");
  const { id } = await ctx.params;

  const order = await db.radiologyOrder.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { include: { user: true } },
    },
  });
  if (!order) throw new ApiError(404, "Radiology order not found");
  return ok(order);
});

export const PATCH = route(async (req: Request, ctx) => {
  const actor = await requirePermission("radiology:manage");
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  if (body && typeof body === "object" && "status" in body) {
    const status = String(body.status);
    if (!["ORDERED", "SCHEDULED", "COMPLETED", "CANCELLED"].includes(status)) {
      throw new ApiError(400, "Invalid status");
    }
    const order = await updateRadiologyOrderStatus(
      { userId: actor.id, hospitalId: actor.hospitalId },
      id,
      status
    );
    await logAudit({
      userId: actor.id,
      action: "RADIOLOGY_ORDER_STATUS_CHANGED",
      entity: "RadiologyOrder",
      entityId: id,
      meta: { status },
      ipAddress: getIp(req),
    });
    return ok(order);
  }

  const input = assertInput(radiologyResultSchema, body);
  const order = await submitRadiologyReport(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id,
    input
  );
  await logAudit({
    userId: actor.id,
    action: "RADIOLOGY_REPORT_SUBMITTED",
    entity: "RadiologyOrder",
    entityId: id,
    ipAddress: getIp(req),
  });
  return ok(order);
});

export const DELETE = route(async (req, ctx) => {
  await requirePermission("radiology:manage");
  const { id } = await ctx.params;

  const existing = await db.radiologyOrder.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Radiology order not found");
  await db.radiologyOrder.delete({ where: { id } });
  return ok({ deleted: true });
});
