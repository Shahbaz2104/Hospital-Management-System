import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { nextSeq } from "@/lib/sequences";
import { logAudit } from "@/services/audit";

type Actor = { userId: string; hospitalId?: string | null };

async function nextAdmissionNo(): Promise<string> {
  return nextSeq(() => db.admission.findMany({ select: { admissionNo: true } }), "admissionNo", "IPD");
}

export async function listAdmissions(filters: { status?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;

  return db.admission.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          patientNo: true,
          firstName: true,
          lastName: true,
          gender: true,
          phone: true,
        },
      },
      bed: { include: { room: { select: { number: true, type: true } } } },
      doctor: {
        include: { user: { select: { firstName: true, lastName: true, title: true } } },
      },
    },
    orderBy: [{ admittedAt: "desc" }],
  });
}

export async function createAdmission(
  actor: Actor,
  input: {
    patientId: string;
    bedId?: string;
    doctorId?: string;
    reason?: string;
    diagnosis?: string;
    notes?: string;
  }
) {
  const patient = await db.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) throw new ApiError(404, "Patient not found");

  const active = await db.admission.findFirst({
    where: { patientId: input.patientId, status: { in: ["ADMITTED", "TRANSFERRED"] } },
  });
  if (active) throw new ApiError(409, "Patient already has an active admission");

  let bed = null;
  if (input.bedId) {
    bed = await db.bed.findUnique({ where: { id: input.bedId } });
    if (!bed) throw new ApiError(404, "Bed not found");
    if (bed.status === "OCCUPIED") throw new ApiError(409, "Bed is already occupied");
  }

  const admissionNo = await nextAdmissionNo();

  const admission = await db.$transaction(async (tx) => {
    const created = await tx.admission.create({
      data: {
        admissionNo,
        patientId: input.patientId,
        bedId: input.bedId ?? null,
        doctorId: input.doctorId ?? null,
        reason: input.reason ?? null,
        diagnosis: input.diagnosis ?? null,
        notes: input.notes ?? null,
        hospitalId: actor.hospitalId ?? null,
      },
    });

    if (input.bedId) {
      await tx.bed.update({
        where: { id: input.bedId },
        data: {
          status: "OCCUPIED",
          patientId: input.patientId,
          currentAdmissionId: created.id,
        },
      });
    }

    return created;
  });

  return admission;
}

export async function transferAdmission(
  actor: Actor,
  id: string,
  newBedId: string
) {
  const admission = await db.admission.findUnique({ where: { id } });
  if (!admission) throw new ApiError(404, "Admission not found");
  if (admission.status === "DISCHARGED") {
    throw new ApiError(409, "Discharged admissions cannot be transferred");
  }

  const bed = await db.bed.findUnique({ where: { id: newBedId } });
  if (!bed) throw new ApiError(404, "Bed not found");
  if (bed.status === "OCCUPIED" && bed.currentAdmissionId !== id) {
    throw new ApiError(409, "Target bed is occupied");
  }

  await db.$transaction(async (tx) => {
    if (admission.bedId) {
      await tx.bed.update({
        where: { id: admission.bedId },
        data: { status: "AVAILABLE", patientId: null, currentAdmissionId: null },
      });
    }

    await tx.admission.update({
      where: { id },
      data: { bedId: newBedId, status: "TRANSFERRED" },
    });

    await tx.bed.update({
      where: { id: newBedId },
      data: {
        status: "OCCUPIED",
        patientId: admission.patientId,
        currentAdmissionId: id,
      },
    });
  });
}

export async function dischargeAdmission(actor: Actor, id: string) {
  const admission = await db.admission.findUnique({ where: { id } });
  if (!admission) throw new ApiError(404, "Admission not found");
  if (admission.status === "DISCHARGED") {
    throw new ApiError(409, "Admission is already discharged");
  }

  await db.$transaction(async (tx) => {
    if (admission.bedId) {
      await tx.bed.update({
        where: { id: admission.bedId },
        data: { status: "CLEANING", patientId: null, currentAdmissionId: null },
      });
    }

    await tx.admission.update({
      where: { id },
      data: { status: "DISCHARGED", dischargeAt: new Date() },
    });
  });
}

export async function deleteAdmission(actor: Actor, id: string) {
  const admission = await db.admission.findUnique({ where: { id } });
  if (!admission) throw new ApiError(404, "Admission not found");

  await db.$transaction(async (tx) => {
    if (admission.bedId && admission.status !== "DISCHARGED") {
      await tx.bed.update({
        where: { id: admission.bedId },
        data: { status: "AVAILABLE", patientId: null, currentAdmissionId: null },
      });
    }
    await tx.admission.delete({ where: { id } });
  });

  await logAudit({
    userId: actor.userId,
    action: "ADMISSION_DELETED",
    entity: "Admission",
    entityId: id,
    meta: { admissionNo: admission.admissionNo },
  });
}
