import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { revenueStats } from "@/services/billing";

export const GET = route(async () => {
  await requirePermission("billing:read");
  return ok(await revenueStats());
});
