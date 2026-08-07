import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createSupplier, listSuppliers } from "@/services/pharmacy";
import { supplierSchema } from "@/validators/pharmacy";

export const GET = route(async (req) => {
  await requirePermission("inventory:read");
  const params = new URL(req.url).searchParams;
  const items = await listSuppliers(params.get("active") === "true");
  return ok({ items });
});

export const POST = route(async (req) => {
  const actor = await requirePermission("inventory:manage");
  const input = assertInput(supplierSchema, await req.json());
  const supplier = await createSupplier({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "SUPPLIER_CREATED",
    entity: "Supplier",
    entityId: supplier.id,
    meta: { name: supplier.name },
    ipAddress: getIp(req),
  });
  return ok(supplier);
});
