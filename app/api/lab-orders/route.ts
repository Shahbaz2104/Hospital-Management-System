import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createLabOrder, listLabOrders } from "@/services/diagnostics";
import { labOrderSchema } from "@/validators/diagnostics";

export const GET = route(async (req: Request) => {
  await requirePermission("laboratory:read");

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const patientId = url.searchParams.get("patientId") ?? undefined;

  const orders = await listLabOrders({ status, patientId });
  return ok({ items: orders });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("laboratory:manage");
  const input = assertInput(labOrderSchema, await req.json().catch(() => null));

  const order = await createLabOrder(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "LAB_ORDER_CREATED",
    entity: "LabOrder",
    entityId: order.id,
    meta: { orderNo: order.orderNo },
    ipAddress: getIp(req),
  });
  return ok(order, { status: 201 });
});
