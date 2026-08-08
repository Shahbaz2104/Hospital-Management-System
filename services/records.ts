import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import type { MedicalRecordCreateInput } from "@/validators/records";

async function nextRecordNo(): Promise<string> {
  const last = await db.medicalRecord.findFirst({
    orderBy: { recordNo: "desc" },
    select: { recordNo: true },
  });
  const n = last ? parseInt(String(last.recordNo).replace(/\D+/g, ""), 10) || 0 : 0;
  return `MR-${String(n + 1).padStart(4, "0")}`;
}

export async function listRecords(opts: { patientId?: string; type?: string; search?: string }) {
  const where: Record<string, unknown> = {};
  if (opts.patientId) where.patientId = opts.patientId;
  if (opts.type) where.type = opts.type;
  if (opts.search) {
    where.OR = [
      { title: { contains: opts.search } },
      { summary: { contains: opts.search } },
      { patient: { firstName: { contains: opts.search } } },
      { patient: { lastName: { contains: opts.search } } },
      { patient: { patientNo: { contains: opts.search } } },
    ];
  }
  const [items, total] = await Promise.all([
    db.medicalRecord.findMany({
      where,
      include: {
        patient: { select: { id: true, patientNo: true, firstName: true, lastName: true } },
        doctor: { include: { user: { select: { title: true, firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.medicalRecord.count({ where }),
  ]);
  return { items, total };
}

export async function createRecord(actor: { id: string }, input: MedicalRecordCreateInput) {
  const recordNo = await nextRecordNo();
  const record = await db.medicalRecord.create({
    data: {
      recordNo,
      patientId: input.patientId,
      type: input.type,
      title: input.title,
      summary: input.summary || null,
      doctorId: input.doctorId || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
    },
    include: {
      patient: { select: { id: true, patientNo: true, firstName: true, lastName: true } },
      doctor: { include: { user: { select: { title: true, firstName: true, lastName: true } } } },
    },
  });
  logAudit({ userId: actor.id, action: "RECORD_CREATED", entity: "MedicalRecord", entityId: record.id, meta: { recordNo } });
  return record;
}

export async function getPatientRecords(patientId: string) {
  return db.medicalRecord.findMany({
    where: { patientId },
    include: { doctor: { include: { user: { select: { title: true, firstName: true, lastName: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
