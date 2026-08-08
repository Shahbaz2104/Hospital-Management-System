import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { unreadCount } from "@/services/notifications";

export const GET = route(async () => {
  const actor = await requirePermission("notifications:read");
  return ok({ unread: await unreadCount(actor.id) });
});
