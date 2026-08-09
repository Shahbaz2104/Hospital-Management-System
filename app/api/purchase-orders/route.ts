import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createPurchaseOrder, listPurchaseOrders } from "@/services/pharmacy";
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
