import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { logAudit } from "@/services/audit";
import type { AppointmentInput, PatientInput } from "@/validators/clinical";

type Actor = { userId: string; hospitalId?: string | null };

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

async function nextPatientNo(): Promise<string> {
  const last = await db.patient.findFirst({
    orderBy: { patientNo: "desc" },
    select: { patientNo: true },
  });
  const n = last ? parseInt(last.patientNo.replace(/\D+/g, ""), 10) || 0 : 0;
  return `PT-${String(n + 1).padStart(4, "0")}`;
}

export async function listPatients(search = "") {
  return db.patient.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { patientNo: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
    include: { _count: { select: { appointments: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPatient(actor: Actor, input: PatientInput) {
  const patientNo = await nextPatientNo();
  const patient = await db.patient.create({
    data: {
      patientNo,
      firstName: input.firstName,
      lastName: input.lastName,
      dob: input.dob ?? null,
      gender: input.gender ?? null,
      bloodGroup: input.bloodGroup ?? null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address ?? null,
      city: input.city ?? null,
      emergencyContact: input.emergencyContact ?? null,
      heightCm: input.heightCm ?? null,
      weightKg: input.weightKg ?? null,
      allergies: input.allergies ?? null,
      medicalHistory: input.medicalHistory ?? null,
      previousDiseases: input.previousDiseases ?? null,
      currentMedication: input.currentMedication ?? null,
      vaccinationHistory: input.vaccinationHistory ?? null,
      insuranceProvider: input.insuranceProvider ?? null,
      insuranceNumber: input.insuranceNumber ?? null,
      insurancePlan: input.insurancePlan ?? null,
      insuranceExpiry: input.insuranceExpiry ?? null,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  return patient;
}

export async function updatePatient(
  _actor: Actor,
  id: string,
  input: Partial<PatientInput>
) {
  const existing = await db.patient.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Patient not found");

  const updated = await db.patient.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      dob: input.dob ?? undefined,
      gender: input.gender ?? undefined,
      bloodGroup: input.bloodGroup ?? undefined,
      phone: input.phone ?? undefined,
      email: input.email || undefined,
      address: input.address ?? undefined,
      city: input.city ?? undefined,
      emergencyContact: input.emergencyContact ?? undefined,
      heightCm: input.heightCm ?? undefined,
      weightKg: input.weightKg ?? undefined,
      allergies: input.allergies ?? undefined,
      medicalHistory: input.medicalHistory ?? undefined,
      previousDiseases: input.previousDiseases ?? undefined,
      currentMedication: input.currentMedication ?? undefined,
      vaccinationHistory: input.vaccinationHistory ?? undefined,
      insuranceProvider: input.insuranceProvider ?? undefined,
      insuranceNumber: input.insuranceNumber ?? undefined,
      insurancePlan: input.insurancePlan ?? undefined,
      insuranceExpiry: input.insuranceExpiry ?? undefined,
    },
  });

  return updated;
}

export async function deletePatient(actor: Actor, id: string) {
  const existing = await db.patient.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Patient not found");

  await db.patient.delete({ where: { id } });
  await logAudit({
    userId: actor.userId,
    action: "PATIENT_DELETED",
    entity: "Patient",
    entityId: id,
    meta: { patientNo: existing.patientNo },
  });
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

async function nextToken() {
  const last = await db.appointment.findFirst({
    orderBy: { tokenNo: "desc" },
    select: { tokenNo: true },
  });
  const n = last ? parseInt(last.tokenNo.replace(/\D+/g, ""), 10) || 0 : 0;
  return `TKN-${String(n + 1).padStart(4, "0")}`;
}

export async function listAppointments(
  search = "",
  filters: { doctorId?: string; departmentId?: string; status?: string; date?: string } = {}
) {
  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { tokenNo: { contains: search, mode: "insensitive" } },
      { patient: { firstName: { contains: search, mode: "insensitive" } } },
      { patient: { lastName: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (filters.doctorId) where.doctorId = filters.doctorId;
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.status) where.status = filters.status;
  if (filters.date) where.date = new Date(`${filters.date}T00:00:00`);

  return db.appointment.findMany({
    where,
    include: {
      patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, phone: true } },
      doctor: { include: { user: { select: { firstName: true, lastName: true, title: true } } } },
      department: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function createAppointment(actor: Actor, input: AppointmentInput) {
  if (input.endTime <= input.startTime) {
    throw new ApiError(400, "End time must be after start time");
  }

  const patient = await db.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) throw new ApiError(404, "Patient not found");

  if (input.doctorId) {
    const doctor = await db.doctor.findUnique({ where: { id: input.doctorId } });
    if (!doctor) throw new ApiError(404, "Doctor not found");
    if (!doctor.available) {
      throw new ApiError(409, "This doctor is unavailable right now");
    }
  }

  const date = new Date(input.date);
  date.setHours(0, 0, 0, 0);

  const tokenNo = await nextToken();
  const appointment = await db.appointment.create({
    data: {
      tokenNo,
      patientId: input.patientId,
      doctorId: input.doctorId || null,
      departmentId: input.departmentId || null,
      date,
      startTime: input.startTime,
      endTime: input.endTime,
      type: input.type,
      reason: input.reason ?? null,
      createdById: actor.userId ?? null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true, patientNo: true } },
    },
  });

  return appointment;
}

export async function setAppointmentStatus(
  _actor: Actor,
  id: string,
  status: string
) {
  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Appointment not found");

  return db.appointment.update({
    where: { id },
    data: { status },
  });
}

export async function deleteAppointment(actor: Actor, id: string) {
  const existing = await db.appointment.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Appointment not found");

  await db.appointment.delete({ where: { id } });
  await logAudit({
    userId: actor.userId,
    action: "APPOINTMENT_DELETED",
    entity: "Appointment",
    entityId: id,
  });
}