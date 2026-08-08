import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { generatePayroll, listPayroll } from "@/services/hr";
import { payrollGenerateSchema } from "@/validators/hr";

export const GET = route(async (req) => {
  await requirePermission("payroll:read");
  const url = new URL(req.url);
  return ok(
    await listPayroll({
      month: url.searchParams.get("month")?.trim() || undefined,
      status: url.searchParams.get("status")?.trim() || undefined,
      search: url.searchParams.get("search")?.trim() || undefined,
    })
  );
});

export const POST = route(async (req) => {
  const actor = await requirePermission("payroll:manage");
  const input = assertInput(payrollGenerateSchema, await req.json());
  const result = await generatePayroll({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  return ok(result, { status: 201 });
});
