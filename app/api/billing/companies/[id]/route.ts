import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { updateInsuranceCompany } from "@/services/billing";
import { insuranceCompanySchema } from "@/validators/billing";

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("insurance:manage");
  const { id } = await ctx.params;
  const input = assertInput(insuranceCompanySchema.partial(), await req.json().catch(() => null));
  const company = await updateInsuranceCompany({ userId: actor.id, hospitalId: actor.hospitalId }, id, input);
  await logAudit({
    userId: actor.id,
    action: "INSURANCE_COMPANY_UPDATED",
    entity: "InsuranceCompany",
    entityId: id,
    meta: { name: company.name },
    ipAddress: getIp(req),
  });
  return ok(company);
});
