import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createInsuranceCompany, listInsuranceCompanies } from "@/services/billing";
import { insuranceCompanySchema } from "@/validators/billing";

export const GET = route(async () => {
  await requirePermission("insurance:read");
  return ok({ items: await listInsuranceCompanies(false) });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("insurance:manage");
  const input = assertInput(insuranceCompanySchema, await req.json());
  const company = await createInsuranceCompany({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "INSURANCE_COMPANY_CREATED",
    entity: "InsuranceCompany",
    entityId: company.id,
    meta: { name: company.name },
    ipAddress: getIp(req),
  });
  return ok(company);
});
