import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ApiError, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { decideClaim } from "@/services/billing";
import { claimDecisionSchema } from "@/validators/billing";

export const GET = route(async (req, ctx) => {
  await requirePermission("insurance:read");
  const { id } = await ctx.params;
  const claim = await db.insuranceClaim.findUnique({
    where: { id },
    include: {
      invoice: { select: { invoiceNo: true, total: true, insuranceCoverage: true } },
      policy: { include: { company: { select: { name: true } }, patient: { select: { patientNo: true, firstName: true, lastName: true } } } },
    },
  });
  if (!claim) throw new ApiError(404, "Claim not found");
  return ok(claim);
});

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("insurance:manage");
  const { id } = await ctx.params;
  const input = assertInput(claimDecisionSchema, await req.json().catch(() => null));
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
