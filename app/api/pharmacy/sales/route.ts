import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createSale, listSales } from "@/services/pharmacy";
import { saleSchema } from "@/validators/pharmacy";

export const GET = route(async (req) => {
  await requirePermission("pharmacy:read");
  const params = new URL(req.url).searchParams;
  const items = await listSales({ patientId: params.get("patientId") ?? undefined });
  return ok({ items });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("pharmacy:manage");
  const input = assertInput(saleSchema, await req.json());
  const sale = await createSale({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "MEDICINE_SALE_CREATED",
    entity: "MedicineSale",
    entityId: sale.id,
    meta: { saleNo: sale.saleNo, total: sale.total },
    ipAddress: getIp(req),
  });
  return ok(sale);
});
