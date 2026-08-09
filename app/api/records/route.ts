import { requirePermission } from "@/lib/auth/guards";
import { getPatientScope } from "@/lib/auth/scoping";
import { assertInput, ok, route } from "@/lib/http";
import { createRecord, listRecords } from "@/services/records";
import { medicalRecordCreateSchema } from "@/validators/records";

export const GET = route(async (req) => {
  const actor = await requirePermission("records:read");
  const url = new URL(req.url);

  // IDOR guard: PATIENT actors only see their own records; the query param
  // is ignored for them (a patient cannot read other patients' records).
  const scopedPatientId = await getPatientScope(actor);

  return ok(
    await listRecords({
      patientId: scopedPatientId ?? url.searchParams.get("patientId") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      search: url.searchParams.get("q") ?? undefined,
    })
  );
});

export const POST = route(async (req) => {
  const actor = await requirePermission("records:manage");
  const input = assertInput(medicalRecordCreateSchema, await req.json());
  return ok(await createRecord(actor, input));
});
