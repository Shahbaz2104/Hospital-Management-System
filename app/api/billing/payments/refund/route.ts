import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { refundPayment } from "@/services/billing";
import { refundSchema } from "@/validators/billing";

export const POST = route(async (req) => {
  const actor = await requirePermission("payments:manage");
  const input = assertInput(refundSchema, await req.json().catch(() => null));
  const refund = await refundPayment({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "PAYMENT_REFUNDED",
    entity: "Payment",
    entityId: refund.id,
    meta: { paymentNo: refund.paymentNo },
    ipAddress: getIp(req),
  });
  return ok(refund);
});
