import { requirePermission } from "@/lib/auth/guards";
import { ApiError, assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
} from "@/services/pharmacy";
import { purchaseOrderSchema } from "@/validators/pharmacy";

export const GET = route(async (req) => {
  await requirePermission("pharmacy:read");
  const params = new URL(req.url).searchParams;
  const items = await listPurchaseOrders({ status: params.get("status") ?? "ALL" });
  return ok({ items });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("pharmacy:manage");
  const input = assertInput(purchaseOrderSchema, await req.json().catch(() => null));
  const order = await createPurchaseOrder({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "PURCHASE_ORDER_CREATED",
    entity: "PurchaseOrder",
    entityId: order.id,
    meta: { poNo: order.poNo },
    ipAddress: getIp(req),
  });
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
