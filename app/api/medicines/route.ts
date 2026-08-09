import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createMedicine, listMedicines } from "@/services/pharmacy";
import { medicineSchema } from "@/validators/pharmacy";

export const GET = route(async (req) => {
  await requirePermission("pharmacy:read");
  const params = new URL(req.url).searchParams;
  const items = await listMedicines({
    category: params.get("category") ?? "ALL",
    status: params.get("status") ?? "ALL",
    search: params.get("search") ?? undefined,
  });
  return ok({ items });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("pharmacy:manage");
  const input = assertInput(medicineSchema, await req.json().catch(() => null));
  const medicine = await createMedicine({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "MEDICINE_CREATED",
    entity: "Medicine",
    entityId: medicine.id,
    meta: { name: medicine.name },
    ipAddress: getIp(req),
  });
  return ok(medicine);
});
