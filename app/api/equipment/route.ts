import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createEquipment, listEquipment } from "@/services/inventory";
import { equipmentSchema } from "@/validators/pharmacy";

export const GET = route(async (req) => {
  await requirePermission("inventory:read");
  const params = new URL(req.url).searchParams;
  const items = await listEquipment({
    status: params.get("status") ?? "ALL",
    category: params.get("category") ?? "ALL",
  });
  return ok({ items });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("inventory:manage");
  const input = assertInput(equipmentSchema, await req.json().catch(() => null));
  const equipment = await createEquipment({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "EQUIPMENT_CREATED",
    entity: "MedicalEquipment",
    entityId: equipment.id,
    meta: { name: equipment.name },
    ipAddress: getIp(req),
  });
  return ok(equipment);
});
