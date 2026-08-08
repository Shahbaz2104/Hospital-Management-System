import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { createPrescription, listPrescriptions, notifyPharmacyOfPrescription } from "@/services/prescriptions";
import { prescriptionCreateSchema } from "@/validators/prescriptions";

export const GET = route(async (req) => {
  await requirePermission("prescriptions:read");
  const url = new URL(req.url);
  return ok(
    await listPrescriptions({
      patientId: url.searchParams.get("patientId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      search: url.searchParams.get("q") ?? undefined,
    })
  );
});

export const POST = route(async (req) => {
  const actor = await requirePermission("prescriptions:create");
  const input = assertInput(prescriptionCreateSchema, await req.json());
  const prescription = await createPrescription(actor, input);
  await notifyPharmacyOfPrescription(prescription);
  return ok(prescription);
});
