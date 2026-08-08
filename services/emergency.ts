import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { notify } from "@/services/notifications";
import type {
  AmbulanceDispatchInput,
  EmergencyCaseCreateInput,
  EmergencyEventInput,
  EmergencyUpdateInput,
} from "@/validators/emergency";

async function nextCaseNo(): Promise<string> {
  const last = await db.emergencyCase.findFirst({
    orderBy: { caseNo: "desc" },
    select: { caseNo: true },
  });
  const n = last ? parseInt(String(last.caseNo).replace(/\D+/g, ""), 10) || 0 : 0;
  return `ER-${String(n + 1).padStart(4, "0")}`;
}

const listInclude = {
  patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, gender: true, phone: true } },
  assignedDoctor: { include: { user: { select: { title: true, firstName: true, lastName: true } } } },
  admittedAsAdmission: { select: { admissionNo: true, bed: { select: { number: true } } } },
  events: { orderBy: { createdAt: "desc" as const }, take: 5, include: { createdBy: { select: { firstName: true, lastName: true } } } },
};

export async function listEmergencyCases(opts: { status?: string; triageLevel?: string; search?: string }) {
  const where: Record<string, unknown> = {};
  if (opts.status) where.status = opts.status;
  if (opts.triageLevel) where.triageLevel = opts.triageLevel;
  if (opts.search) {
    where.OR = [
      { caseNo: { contains: opts.search } },
      { condition: { contains: opts.search } },
      { walkInName: { contains: opts.search } },
      { patient: { firstName: { contains: opts.search } } },
      { patient: { lastName: { contains: opts.search } } },
    ];
  }
  const [items, total, activeCounts] = await Promise.all([
    db.emergencyCase.findMany({
      where,
      include: listInclude,
      orderBy: [
        { triageLevel: "desc" },
        { createdAt: "asc" },
      ],
      take: 100,
    }),
    db.emergencyCase.count({ where }),
    db.emergencyCase.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    items,
    total,
    statusCounts: Object.fromEntries(activeCounts.map((c) => [c.status, c._count._all])),
  };
}

export async function createEmergencyCase(
  actor: { id: string },
  input: EmergencyCaseCreateInput
) {
  const caseNo = await nextCaseNo();
  const case_ = await db.emergencyCase.create({
    data: {
      caseNo,
      patientId: input.patientId || null,
      walkInName: input.walkInName || null,
      walkInPhone: input.walkInPhone || null,
      age: input.age ?? null,
      gender: input.gender ?? null,
      triageLevel: input.triageLevel,
      condition: input.condition || null,
      vitals: input.vitals ? JSON.stringify(input.vitals) : null,
      ambulanceRequested: input.ambulanceRequested,
      ambulanceNotes: input.ambulanceNotes || null,
      createdById: actor.id,
    },
  });

  await db.emergencyEvent.create({
    data: {
      caseId: case_.id,
      type: "NOTE",
      note: `Case opened${input.ambulanceRequested ? " with ambulance requested" : ""}. Triage: ${input.triageLevel}.`,
      createdById: actor.id,
    },
  });

  if (input.ambulanceRequested) {
    await db.emergencyCase.update({
      where: { id: case_.id },
      data: { ambulanceDispatchedAt: new Date(), status: "IN_PROGRESS" },
    });
  }

  await notify({
    roles: ["DOCTOR", "NURSE", "HOSPITAL_ADMIN"],
    title: `Emergency: ${input.condition || input.walkInName || "New case"}`,
    message: `${caseNo} — triage ${input.triageLevel}.`,
    type: "EMERGENCY",
    entity: "EmergencyCase",
    entityId: case_.id,
  });

  logAudit({ userId: actor.id, action: "EMERGENCY_CREATED", entity: "EmergencyCase", entityId: case_.id, meta: { caseNo } });
  return db.emergencyCase.findUnique({ where: { id: case_.id }, include: listInclude });
}

export async function updateEmergencyCase(
  actor: { id: string },
  id: string,
  input: EmergencyUpdateInput
) {
  const existing = await db.emergencyCase.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Emergency case not found");

  const updated = await db.emergencyCase.update({
    where: { id },
    data: {
      status: input.status,
      triageLevel: input.triageLevel,
      assignedDoctorId: input.assignedDoctorId === undefined ? undefined : input.assignedDoctorId,
      condition: input.condition,
      vitals: input.vitals ? JSON.stringify(input.vitals) : undefined,
    },
  });

  const changes: string[] = [];
  if (input.status) changes.push(`Status → ${input.status}`);
  if (input.triageLevel) changes.push(`Triage → ${input.triageLevel}`);
  if (input.assignedDoctorId !== undefined) {
    changes.push(input.assignedDoctorId ? "Doctor assigned" : "Doctor unassigned");
  }
  if (changes.length) {
    await db.emergencyEvent.create({
      data: { caseId: id, type: "STATUS", note: changes.join(" · "), createdById: actor.id },
    });
  }

  logAudit({ userId: actor.id, action: "EMERGENCY_UPDATED", entity: "EmergencyCase", entityId: id, meta: { changes } });
  return updated;
}

export async function dispatchAmbulance(
  actor: { id: string },
  id: string,
  input: AmbulanceDispatchInput
) {
  const existing = await db.emergencyCase.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Emergency case not found");

  const updated = await db.emergencyCase.update({
    where: { id },
    data: {
      ambulanceRequested: true,
      ambulanceDispatchedAt: existing.ambulanceDispatchedAt ?? new Date(),
      ambulanceEtaMinutes: input.etaMinutes,
      ambulanceNotes: input.notes ?? existing.ambulanceNotes,
      status: existing.status === "WAITING" ? "IN_PROGRESS" : existing.status,
    },
  });
  await db.emergencyEvent.create({
    data: {
      caseId: id,
      type: "AMBULANCE",
      note: `Ambulance dispatched, ETA ${input.etaMinutes} min${input.notes ? ` — ${input.notes}` : ""}.`,
      createdById: actor.id,
    },
  });
  logAudit({ userId: actor.id, action: "EMERGENCY_AMBULANCE", entity: "EmergencyCase", entityId: id, meta: { etaMinutes: input.etaMinutes } });
  return updated;
}

export async function addEvent(actor: { id: string }, id: string, input: EmergencyEventInput) {
  const existing = await db.emergencyCase.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Emergency case not found");
  const event = await db.emergencyEvent.create({
    data: { caseId: id, type: input.type, note: input.note, createdById: actor.id },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });
  logAudit({ userId: actor.id, action: "EMERGENCY_EVENT", entity: "EmergencyCase", entityId: id, meta: { type: input.type } });
  return event;
}

export async function listEvents(id: string) {
  return db.emergencyEvent.findMany({
    where: { caseId: id },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });
}
