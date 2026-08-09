import { requirePermission } from "@/lib/auth/guards";
import { assertPatientScope, getPatientScope } from "@/lib/auth/scoping";
import { ok, route } from "@/lib/http";
import { getPatientRecords } from "@/services/records";

export const GET = route(async (req, ctx) => {
  const actor = await requirePermission("records:read");
  const { patientId } = await ctx.params;

  // IDOR guard: PATIENT actors may only read their own records.
  assertPatientScope(actor, patientId, await getPatientScope(actor));

  return ok(await getPatientRecords(patientId));
});
