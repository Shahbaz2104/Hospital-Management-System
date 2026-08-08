import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { analyticsOverview } from "@/services/analytics";

export const GET = route(async () => {
  await requirePermission("analytics:read");
  return ok(await analyticsOverview());
});
