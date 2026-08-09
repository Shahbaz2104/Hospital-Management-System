import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { globalSearch } from "@/services/search";

export const GET = route(async (req) => {
  const user = await requirePermission("dashboard:read");
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit")) || 8;
  return ok(await globalSearch(q, { limit, user }));
});
