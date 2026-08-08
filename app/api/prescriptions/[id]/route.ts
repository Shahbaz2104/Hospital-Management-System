import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { parseItems, updatePrescriptionStatus } from "@/services/prescriptions";
import { prescriptionStatusSchema } from "@/validators/prescriptions";

export const GET = route(async (req, ctx) => {
  await requirePermission("prescriptions:read");
  const { id } = await ctx.params;
  const prescription = await db.prescription.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, dob: true, gender: true } },
      doctor: {
        include: {
          user: { select: { title: true, firstName: true, lastName: true } },
          department: { select: { name: true } },
        },
      },
      consultation: { select: { consultationNo: true, diagnosis: true } },
    },
  });
  if (!prescription) throw new ApiError(404, "Prescription not found");
  return ok({ ...prescription, items: parseItems(prescription.items) });
});

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("prescriptions:manage");
  const { id } = await ctx.params;
  const input = assertInput(prescriptionStatusSchema, await req.json());
  return ok(await updatePrescriptionStatus(actor, id, input.status));
});
