import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { markRead } from "@/services/notifications";
import { markNotificationReadSchema } from "@/validators/notifications";

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("notifications:read");
  const { id } = await ctx.params;
  const input = assertInput(markNotificationReadSchema, await req.json().catch(() => null));
  const notification = await markRead(actor.id, id, input.read);
  return ok(notification);
});
