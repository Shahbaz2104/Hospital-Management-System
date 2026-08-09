import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";

type Actor = { userId: string; hospitalId?: string | null };

async function nextLabOrderNo(): Promise<string> {
  const last = await db.labOrder.findFirst({
    orderBy: { orderNo: "desc" },
    select: { orderNo: true },
  });
  const n = last ? parseInt(last.orderNo.replace(/\D+/g, ""), 10) || 0 : 0;
  return `LAB-${String(n + 1).padStart(4, "0")}`;
}

async function nextRadiologyOrderNo(): Promise<string> {
  const last = await db.radiologyOrder.findFirst({
    orderBy: { orderNo: "desc" },
    select: { orderNo: true },
  });
  const n = last ? parseInt(last.orderNo.replace(/\D+/g, ""), 10) || 0 : 0;
  return `RAD-${String(n + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Lab tests catalog
// ---------------------------------------------------------------------------

export async function listLabTests() {
  return db.labTest.findMany({ orderBy: { name: "asc" } });
}

export async function createLabTest(actor: Actor, input: {
  name: string;
  code: string;
  category: string;
  unit?: string;
  normalRange?: string;
  price?: number;
  description?: string;
}) {
  const test = await db.labTest.create({
    data: {
      name: input.name,
      code: input.code,
      category: input.category,
      unit: input.unit ?? null,
      normalRange: input.normalRange ?? null,
      price: input.price ?? 0,
      description: input.description ?? null,
      hospitalId: actor.hospitalId ?? null,
    },
  });
  return test;
}

// ---------------------------------------------------------------------------
// Lab orders
// ---------------------------------------------------------------------------

export async function listLabOrders(filters: { status?: string; patientId?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.patientId) where.patientId = filters.patientId;

  return db.labOrder.findMany({
    where,
    include: {
      patient: {
        select: { id: true, patientNo: true, firstName: true, lastName: true, gender: true, dob: true },
      },
      doctor: {
        include: { user: { select: { firstName: true, lastName: true, title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createLabOrder(
  actor: Actor,
  input: { patientId: string; doctorId?: string; priority?: string; testIds: string[]; notes?: string }
) {
  const patient = await db.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) throw new ApiError(404, "Patient not found");

  const tests = await db.labTest.findMany({ where: { id: { in: input.testIds } } });
  if (tests.length !== input.testIds.length) {
    throw new ApiError(400, "One or more tests were not found");
  }

  const orderNo = await nextLabOrderNo();
  const order = await db.labOrder.create({
    data: {
      orderNo,
      patientId: input.patientId,
      doctorId: input.doctorId ?? null,
      priority: input.priority ?? "ROUTINE",
      tests: JSON.stringify(
        tests.map((t) => ({
          testId: t.id,
          name: t.name,
          code: t.code,
          unit: t.unit,
          normalRange: t.normalRange,
        }))
      ),
      notes: input.notes ?? null,
      createdById: actor.userId,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  return order;
}

export async function updateLabOrderStatus(
  _actor: Actor,
  id: string,
  status: string
) {
  const order = await db.labOrder.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Lab order not found");

  const data: Record<string, unknown> = { status };
  if (status === "SAMPLE_COLLECTED") data.sampleCollectedAt = new Date();
  if (status === "COMPLETED") data.completedAt = new Date();

  return db.labOrder.update({ where: { id }, data });
}

export async function submitLabResults(
  _actor: Actor,
  id: string,
  results: { testId: string; name: string; value: string; unit?: string; normalRange?: string; flag?: string }[]
) {
  const order = await db.labOrder.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Lab order not found");
  if (order.status === "CANCELLED") throw new ApiError(409, "Cancelled orders cannot take results");

  const tests = JSON.parse(order.tests) as { testId: string; name: string; unit: string | null; normalRange: string | null }[];
  const orderedIds = new Set(tests.map((t) => t.testId));
  const unknown = results.filter((r) => !orderedIds.has(r.testId));
  if (unknown.length > 0) {
    throw new ApiError(400, `Result includes tests not on this order: ${unknown.map((r) => r.name).join(", ")}`);
  }
  const enriched = results.map((r) => {
    const t = tests.find((x) => x.testId === r.testId);
    return {
      ...r,
      unit: r.unit ?? t?.unit ?? "",
      normalRange: r.normalRange ?? t?.normalRange ?? "",
    };
  });

  return db.labOrder.update({
    where: { id },
    data: { results: JSON.stringify(enriched), status: "COMPLETED", completedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Radiology orders
// ---------------------------------------------------------------------------

export async function listRadiologyOrders(filters: { status?: string; patientId?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.patientId) where.patientId = filters.patientId;

  return db.radiologyOrder.findMany({
    where,
    include: {
      patient: {
        select: { id: true, patientNo: true, firstName: true, lastName: true, gender: true, dob: true },
      },
      doctor: {
        include: { user: { select: { firstName: true, lastName: true, title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createRadiologyOrder(
  actor: Actor,
  input: { patientId: string; doctorId?: string; modality: string; bodyPart?: string; scheduledAt?: Date; notes?: string }
) {
  const patient = await db.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) throw new ApiError(404, "Patient not found");

  const orderNo = await nextRadiologyOrderNo();
  const order = await db.radiologyOrder.create({
    data: {
      orderNo,
      patientId: input.patientId,
      doctorId: input.doctorId ?? null,
      modality: input.modality,
      bodyPart: input.bodyPart ?? null,
      scheduledAt: input.scheduledAt ?? null,
      notes: input.notes ?? null,
      createdById: actor.userId,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  return order;
}

export async function updateRadiologyOrderStatus(
  _actor: Actor,
  id: string,
  status: string
) {
  const order = await db.radiologyOrder.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Radiology order not found");

  return db.radiologyOrder.update({ where: { id }, data: { status } });
}

export async function submitRadiologyReport(
  _actor: Actor,
  id: string,
  input: { findings: string; reports?: { name: string; url: string }[] }
) {
  const order = await db.radiologyOrder.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Radiology order not found");

  const existing = order.reports ? (JSON.parse(order.reports) as { name: string; url: string; uploadedAt: string }[]) : [];
  const now = new Date().toISOString();
  const reports = [
    ...existing,
    ...(input.reports ?? []).map((r) => ({ ...r, uploadedAt: now })),
  ];

  return db.radiologyOrder.update({
    where: { id },
    data: {
      findings: input.findings,
      reports: JSON.stringify(reports),
      status: "COMPLETED",
    },
  });
}
