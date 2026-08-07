import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { listPayments, recordPayment } from "@/services/billing";
import { recordPaymentSchema } from "@/validators/billing";

export const GET = route(async (req) => {
  await requirePermission("payments:read");
  const params = new URL(req.url).searchParams;
  const items = await listPayments({
    method: params.get("method") ?? "ALL",
    status: params.get("status") ?? "ALL",
    search: params.get("search") ?? undefined,
  });
  return ok({ items });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("payments:manage");
  const input = assertInput(recordPaymentSchema, await req.json());
  const payment = await recordPayment({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "PAYMENT_RECORDED",
    entity: "Payment",
    entityId: payment.id,
    meta: { paymentNo: payment.paymentNo },
    ipAddress: getIp(req),
  });
  return ok(payment);
});
