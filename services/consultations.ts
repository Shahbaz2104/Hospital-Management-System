import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";

type Actor = { userId: string; hospitalId?: string | null };

async function nextConsultationNo(): Promise<string> {
  const last = await db.consultation.findFirst({
    orderBy: { consultationNo: "desc" },
    select: { consultationNo: true },
  });
  const n = last ? parseInt(last.consultationNo.replace(/\D+/g, ""), 10) || 0 : 0;
  return `OPD-${String(n + 1).padStart(4, "0")}`;
}

export async function createConsultation(
  actor: Actor,
  input: {
    appointmentId?: string;
    patientId: string;
    doctorId?: string;
    diagnosis?: string;
    notes?: string;
    followUpDate?: Date;
    vitals?: { name: string; value: string; unit?: string }[];
    prescriptions?: {
      medicine: string;
      dose?: string;
      frequency?: string;
      duration?: string;
      instructions?: string;
    }[];
  }
) {
  const patient = await db.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) throw new ApiError(404, "Patient not found");

  if (input.appointmentId) {
    const appointment = await db.appointment.findUnique({
      where: { id: input.appointmentId },
    });
    if (!appointment) throw new ApiError(404, "Appointment not found");
  }

  const consultationNo = await nextConsultationNo();

  const consultation = await db.consultation.create({
    data: {
      consultationNo,
      appointmentId: input.appointmentId ?? null,
      patientId: input.patientId,
      doctorId: input.doctorId ?? null,
      diagnosis: input.diagnosis ?? null,
      notes: input.notes ?? null,
      followUpDate: input.followUpDate ?? null,
      vitals: input.vitals?.length ? JSON.stringify(input.vitals) : null,
      prescriptions: input.prescriptions?.length
        ? JSON.stringify(input.prescriptions)
        : null,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  if (input.appointmentId) {
    await db.appointment.update({
      where: { id: input.appointmentId },
      data: { status: "COMPLETED" },
    });
  }

  return consultation;
}

export async function listConsultations(filters: { patientId?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.patientId) where.patientId = filters.patientId;

  return db.consultation.findMany({
    where,
    include: {
      patient: {
        select: { id: true, patientNo: true, firstName: true, lastName: true },
      },
      doctor: {
        include: { user: { select: { firstName: true, lastName: true, title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
