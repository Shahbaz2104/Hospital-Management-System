import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ApiError, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import {
  submitLabResults,
  updateLabOrderStatus,
} from "@/services/diagnostics";
import { labResultSchema } from "@/validators/diagnostics";

export const GET = route(async (req, ctx) => {
  await requirePermission("laboratory:read");
  const { id } = await ctx.params;

  const order = await db.labOrder.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { include: { user: true } },
    },
  });
  if (!order) throw new ApiError(404, "Lab order not found");
  return ok(order);
});

export const PATCH = route(async (req: Request, ctx) => {
  const actor = await requirePermission("laboratory:manage");
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  if (body && typeof body === "object" && "status" in body) {
    const status = String(body.status);
    if (!["ORDERED", "SAMPLE_COLLECTED", "COMPLETED", "CANCELLED"].includes(status)) {
      throw new ApiError(400, "Invalid status");
    }
    const order = await updateLabOrderStatus(
      { userId: actor.id, hospitalId: actor.hospitalId },
      id,
      status
    );
    await logAudit({
      userId: actor.id,
      action: "LAB_ORDER_STATUS_CHANGED",
      entity: "LabOrder",
      entityId: id,
      meta: { status },
      ipAddress: getIp(req),
    });
    return ok(order);
  }

  const input = assertInput(labResultSchema, body);
  const order = await submitLabResults(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id,
    input.results
  );
  await logAudit({
    userId: actor.id,
    action: "LAB_RESULTS_SUBMITTED",
    entity: "LabOrder",
    entityId: id,
    ipAddress: getIp(req),
  });
  return ok(order);
});

export const DELETE = route(async (req, ctx) => {
  const actor = await requirePermission("laboratory:manage");
  const { id } = await ctx.params;

  const existing = await db.labOrder.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Lab order not found");
  await db.labOrder.delete({ where: { id } });
  return ok({ deleted: true });
});
