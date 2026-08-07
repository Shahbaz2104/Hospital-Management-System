import { requirePermission } from "@/lib/auth/guards";
import { ApiError, assertInput, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { deleteEquipment, updateEquipment } from "@/services/inventory";
import { equipmentSchema } from "@/validators/pharmacy";

export const GET = route(async (req, ctx) => {
  await requirePermission("inventory:read");
  const { id } = await ctx.params;
  const equipment = await db.medicalEquipment.findUnique({
    where: { id },
    include: { supplier: { select: { id: true, name: true } } },
  });
  if (!equipment) throw new ApiError(404, "Equipment not found");
  return ok(equipment);
});

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("inventory:manage");
  const { id } = await ctx.params;
  const input = assertInput(equipmentSchema.partial(), await req.json());
  const equipment = await updateEquipment({ userId: actor.id, hospitalId: actor.hospitalId }, id, input);
  await logAudit({
    userId: actor.id,
    action: "EQUIPMENT_UPDATED",
    entity: "MedicalEquipment",
    entityId: id,
    meta: { name: equipment.name },
    ipAddress: getIp(req),
  });
  return ok(equipment);
});

export const DELETE = route(async (req, ctx) => {
  const actor = await requirePermission("inventory:manage");
  const { id } = await ctx.params;
  const result = await deleteEquipment({ userId: actor.id, hospitalId: actor.hospitalId }, id);
  await logAudit({
    userId: actor.id,
    action: "EQUIPMENT_DELETED",
    entity: "MedicalEquipment",
    entityId: id,
    ipAddress: getIp(req),
  });
  return ok(result);
});
