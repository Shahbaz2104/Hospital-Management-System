import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { decideClaim } from "@/services/billing";
import { claimDecisionSchema } from "@/validators/billing";

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("insurance:manage");
  const { id } = await ctx.params;
  const input = assertInput(claimDecisionSchema, await req.json());
  const claim = await decideClaim({ userId: actor.id, hospitalId: actor.hospitalId }, id, input);
  await logAudit({
    userId: actor.id,
    action: "INSURANCE_CLAIM_DECIDED",
    entity: "InsuranceClaim",
    entityId: id,
    meta: { claimNo: claim.claimNo, decision: input.status },
    ipAddress: getIp(req),
  });
  return ok(claim);
});
