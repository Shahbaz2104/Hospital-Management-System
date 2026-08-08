import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { listNotifications, markAllRead, runAlerts } from "@/services/notifications";

export const GET = route(async (req) => {
  const actor = await requirePermission("notifications:read");
  const url = new URL(req.url);

  // Lazy alerts: stock / expiry / appointment reminders (deduplicated).
  const alerts = await runAlerts().catch((error) => {
    console.error("[notifications:alerts]", error);
    return null;
  });

  const data = await listNotifications(actor.id, {
    unreadOnly: url.searchParams.get("unread") === "true" || undefined,
    page: Number(url.searchParams.get("page")) || 1,
    pageSize: Number(url.searchParams.get("pageSize")) || 30,
  });
  return ok({ ...data, alerts });
});

export const PATCH = route(async () => {
  const actor = await requirePermission("notifications:read");
  const result = await markAllRead(actor.id);
  return ok(result);
});
