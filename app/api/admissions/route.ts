import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createAdmission, listAdmissions } from "@/services/admissions";
import { admissionSchema } from "@/validators/admissions";

export const GET = route(async (req) => {
  await requirePermission("admissions:read");
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const admissions = await listAdmissions({ status });
  return ok({ items: admissions });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("admissions:manage");
  const input = assertInput(admissionSchema, await req.json().catch(() => null));

  const admission = await createAdmission(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "PATIENT_ADMITTED",
    entity: "Admission",
    entityId: admission.id,
    meta: { admissionNo: admission.admissionNo },
    ipAddress: getIp(req),
  });
  return ok(admission, { status: 201 });
});
