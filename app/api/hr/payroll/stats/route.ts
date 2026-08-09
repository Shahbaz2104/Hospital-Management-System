import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { payrollStats } from "@/services/hr";

export const GET = route(async (req) => {
  const actor = await requirePermission("payroll:read");
  const url = new URL(req.url);
  const month = url.searchParams.get("month")?.trim() ?? new Date().toISOString().slice(0, 7);
  return ok(await payrollStats(month, actor.hospitalId));
});
