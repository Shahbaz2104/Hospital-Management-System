import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { attendanceStats } from "@/services/hr";

export const GET = route(async (req) => {
  const actor = await requirePermission("hr:read");
  const url = new URL(req.url);
  const month = url.searchParams.get("month")?.trim() ?? new Date().toISOString().slice(0, 7);
  return ok(await attendanceStats(month, actor.hospitalId));
});
