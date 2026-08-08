import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { getPatientRecords } from "@/services/records";

export const GET = route(async (req, ctx) => {
  await requirePermission("records:read");
  const { patientId } = await ctx.params;
  return ok(await getPatientRecords(patientId));
});
