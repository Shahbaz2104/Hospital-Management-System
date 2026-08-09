import { requirePermission } from "@/lib/auth/guards";
import { getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createCheckoutSession } from "@/services/billing";

export const POST = route(async (req, ctx) => {
  const actor = await requirePermission("billing:manage");
  const { id } = await ctx.params;
  const session = await createCheckoutSession(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id
  );
  await logAudit({
    userId: actor.id,
    action: "PAYMENT_RECORDED",
    entity: "Invoice",
    entityId: id,
    meta: { checkoutSessionId: session.sessionId },
    ipAddress: getIp(req),
  });
  return ok(session);
});
