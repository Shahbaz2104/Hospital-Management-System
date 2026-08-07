import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import {
  createRadiologyOrder,
  listRadiologyOrders,
} from "@/services/diagnostics";
import { radiologyOrderSchema } from "@/validators/diagnostics";

export const GET = route(async (req: Request) => {
  await requirePermission("radiology:read");

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const patientId = url.searchParams.get("patientId") ?? undefined;

  const orders = await listRadiologyOrders({ status, patientId });
  return ok({ items: orders });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("radiology:manage");
  const input = assertInput(radiologyOrderSchema, await req.json().catch(() => null));

  const order = await createRadiologyOrder(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "RADIOLOGY_ORDER_CREATED",
    entity: "RadiologyOrder",
    entityId: order.id,
    meta: { orderNo: order.orderNo },
    ipAddress: getIp(req),
  });
  return ok(order, { status: 201 });
});
