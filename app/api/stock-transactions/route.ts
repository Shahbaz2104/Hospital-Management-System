import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createStockTransaction, listStockTransactions } from "@/services/pharmacy";
import { stockTransactionSchema } from "@/validators/pharmacy";

export const GET = route(async (req) => {
  await requirePermission("inventory:read");
  const params = new URL(req.url).searchParams;
  const items = await listStockTransactions({
    medicineId: params.get("medicineId") ?? undefined,
  });
  return ok({ items });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("inventory:manage");
  const input = assertInput(stockTransactionSchema, await req.json());
  const tx = await createStockTransaction({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "STOCK_TRANSACTION_CREATED",
    entity: "StockTransaction",
    entityId: tx.id,
    ipAddress: getIp(req),
  });
  return ok(tx);
});
