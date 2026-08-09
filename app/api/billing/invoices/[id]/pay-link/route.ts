import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { createCheckoutSession } from "@/services/billing";

/** Returns the shareable Stripe payment link for the invoice's due balance. */
export const GET = route(async (req, ctx) => {
  const actor = await requirePermission("billing:manage");
  const { id } = await ctx.params;
  const session = await createCheckoutSession(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id
  );
  return ok({ url: session.url, sessionId: session.sessionId });
});
