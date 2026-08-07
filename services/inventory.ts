import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import type { EquipmentInput } from "@/validators/pharmacy";
import { logAudit } from "@/services/audit";

type Actor = { userId: string; hospitalId?: string | null };

const WARRANTY_WINDOW_DAYS = 90;

export function warrantyStatus(equipment: { warrantyExpiry: Date | null | undefined }) {
  if (!equipment.warrantyExpiry) return null;
  const days = Math.ceil(
    (equipment.warrantyExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return "EXPIRED";
  if (days <= WARRANTY_WINDOW_DAYS) return "EXPIRING";
  return "OK";
}

export function maintenanceStatus(equipment: { nextMaintenance: Date | null | undefined }) {
  if (!equipment.nextMaintenance) return null;
  const due = equipment.nextMaintenance.getTime() <= Date.now();
  return due ? "DUE" : "SCHEDULED";
}

async function nextEquipmentCode(): Promise<string> {
  const last = await db.medicalEquipment.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const n = last ? parseInt(last.code.replace(/\D+/g, ""), 10) || 0 : 0;
  return `EQ-${String(n + 1).padStart(4, "0")}`;
}

export async function listEquipment(filters: { status?: string; category?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.category && filters.category !== "ALL") where.category = filters.category;

  const equipment = await db.medicalEquipment.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return equipment.map((e) => ({
    ...e,
    warrantyStatus: warrantyStatus(e),
    maintenanceStatus: maintenanceStatus(e),
  }));
}

export async function createEquipment(actor: Actor, input: EquipmentInput) {
  const code = await nextEquipmentCode();
  const equipment = await db.medicalEquipment.create({
    data: {
      ...input,
      code,
      hospitalId: actor.hospitalId ?? null,
    },
  });
  await logAudit({
    userId: actor.userId,
    action: "EQUIPMENT_CREATED",
    entity: "MedicalEquipment",
    entityId: equipment.id,
    meta: { name: equipment.name, code },
  });
  return equipment;
}

export async function updateEquipment(actor: Actor, id: string, input: Partial<EquipmentInput>) {
  const existing = await db.medicalEquipment.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Equipment not found");
  const equipment = await db.medicalEquipment.update({ where: { id }, data: input });
  await logAudit({
    userId: actor.userId,
    action: "EQUIPMENT_UPDATED",
    entity: "MedicalEquipment",
    entityId: id,
    meta: { name: equipment.name },
  });
  return equipment;
}

export async function deleteEquipment(actor: Actor, id: string) {
  const existing = await db.medicalEquipment.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Equipment not found");
  await db.medicalEquipment.delete({ where: { id } });
  await logAudit({
    userId: actor.userId,
    action: "EQUIPMENT_DELETED",
    entity: "MedicalEquipment",
    entityId: id,
    meta: { name: existing.name },
  });
  return { deleted: true };
}
