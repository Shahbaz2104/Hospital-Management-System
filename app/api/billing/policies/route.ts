import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createInsurancePolicy, listPolicies } from "@/services/billing";
import { insurancePolicySchema } from "@/validators/billing";

export const GET = route(async (req) => {
  await requirePermission("insurance:read");
  const params = new URL(req.url).searchParams;
  const items = await listPolicies({
    patientId: params.get("patientId") ?? undefined,
    status: params.get("status") ?? "ALL",
  });
  return ok({ items });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("insurance:manage");
  const input = assertInput(insurancePolicySchema, await req.json());
  const policy = await createInsurancePolicy({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "INSURANCE_POLICY_CREATED",
    entity: "InsurancePolicy",
    entityId: policy.id,
    meta: { policyNumber: policy.policyNumber },
    ipAddress: getIp(req),
  });
  return ok(policy);
});
