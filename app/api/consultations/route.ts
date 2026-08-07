import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createConsultation, listConsultations } from "@/services/consultations";
import { consultationSchema } from "@/validators/consultations";

export const GET = route(async (req: Request) => {
  await requirePermission("consultations:read");

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId") ?? undefined;

  const consultations = await listConsultations({ patientId });
  return ok({ items: consultations });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("consultations:manage");
  const input = assertInput(consultationSchema, await req.json().catch(() => null));

  const consultation = await createConsultation(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "CONSULTATION_CREATED",
    entity: "Consultation",
    entityId: consultation.id,
    meta: { consultationNo: consultation.consultationNo },
    ipAddress: getIp(req),
  });
  return ok(consultation, { status: 201 });
});
