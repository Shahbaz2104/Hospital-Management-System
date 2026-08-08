import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { markPayrollPaid } from "@/services/hr";
import { payrollMarkPaidSchema } from "@/validators/hr";

export const POST = route(async (req) => {
  const actor = await requirePermission("payroll:manage");
  const input = assertInput(payrollMarkPaidSchema, await req.json());
  const result = await markPayrollPaid({ userId: actor.id, hospitalId: actor.hospitalId }, input.ids);
  return ok(result);
});
