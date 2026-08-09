import { requirePermission } from "@/lib/auth/guards";
import { ApiError, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import {
  cancelPurchaseOrder,
  receivePurchaseOrder,
} from "@/services/pharmacy";

export const GET = route(async (_req, ctx) => {
  await requirePermission("pharmacy:read");
  const { id } = await ctx.params;
  const order = await db.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, contactPerson: true, phone: true } },
    },
  });
  if (!order) throw new ApiError(404, "Purchase order not found");
  return ok(order);
});

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("pharmacy:manage");
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const action = body && typeof body === "object" ? String((body as Record<string, unknown>).action ?? "") : "";

  if (action === "receive") {
    const order = await receivePurchaseOrder({ userId: actor.id, hospitalId: actor.hospitalId }, id);
    await logAudit({
      userId: actor.id,
      action: "PURCHASE_ORDER_RECEIVED",
      entity: "PurchaseOrder",
      entityId: id,
      ipAddress: getIp(req),
    });
    return ok(order);
  }
  if (action === "cancel") {
    const order = await cancelPurchaseOrder({ userId: actor.id, hospitalId: actor.hospitalId }, id);
    await logAudit({
      userId: actor.id,
      action: "PURCHASE_ORDER_CANCELLED",
      entity: "PurchaseOrder",
      entityId: id,
      ipAddress: getIp(req),
    });
    return ok(order);
  }
  throw new ApiError(400, "Unknown action");
});