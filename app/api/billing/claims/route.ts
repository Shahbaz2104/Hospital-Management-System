import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createClaim, listClaims } from "@/services/billing";
import { createClaimSchema } from "@/validators/billing";

export const GET = route(async (req) => {
  await requirePermission("insurance:read");
  const params = new URL(req.url).searchParams;
  const items = await listClaims({ status: params.get("status") ?? "ALL" });
  return ok({ items });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("insurance:manage");
  const input = assertInput(createClaimSchema, await req.json());
  const claim = await createClaim({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "INSURANCE_CLAIM_SUBMITTED",
    entity: "InsuranceClaim",
    entityId: claim.id,
    meta: { claimNo: claim.claimNo },
    ipAddress: getIp(req),
  });
  return ok(claim);
});
