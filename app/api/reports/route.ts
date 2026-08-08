import { requirePermission } from "@/lib/auth/guards";
import { ApiError, ok, route } from "@/lib/http";
import { REPORT_TYPES, runReport } from "@/services/reports";

export const GET = route(async (req) => {
  await requirePermission("reports:read");
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  const from = url.searchParams.get("from")?.trim() || undefined;
  const to = url.searchParams.get("to")?.trim() || undefined;

  if (!(REPORT_TYPES as readonly string[]).includes(type)) {
    throw new ApiError(400, `Unknown report type: ${type}`);
  }

  const report = await runReport(type as (typeof REPORT_TYPES)[number], { from, to });
  return ok(report);
});
