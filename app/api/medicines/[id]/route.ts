import { requirePermission } from "@/lib/auth/guards";
import { ApiError, assertInput, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { deleteMedicine, updateMedicine } from "@/services/pharmacy";
import { medicineSchema } from "@/validators/pharmacy";

export const GET = route(async (req, ctx) => {
  await requirePermission("pharmacy:read");
  const { id } = await ctx.params;
  const medicine = await db.medicine.findUnique({ where: { id } });
  if (!medicine) throw new ApiError(404, "Medicine not found");
  return ok(medicine);
});

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("pharmacy:manage");
  const { id } = await ctx.params;
  const input = assertInput(medicineSchema.partial(), await req.json().catch(() => null));
  const medicine = await updateMedicine({ userId: actor.id, hospitalId: actor.hospitalId }, id, input);
  await logAudit({
    userId: actor.id,
    action: "MEDICINE_UPDATED",
    entity: "Medicine",
    entityId: id,
    meta: { name: medicine.name },
    ipAddress: getIp(req),
  });
  return ok(medicine);
});

export const DELETE = route(async (req, ctx) => {
  const actor = await requirePermission("pharmacy:manage");
  const { id } = await ctx.params;
  const result = await deleteMedicine({ userId: actor.id, hospitalId: actor.hospitalId }, id);
  await logAudit({
    userId: actor.id,
    action: "MEDICINE_DELETED",
    entity: "Medicine",
    entityId: id,
    ipAddress: getIp(req),
  });
  return ok(result);
});
