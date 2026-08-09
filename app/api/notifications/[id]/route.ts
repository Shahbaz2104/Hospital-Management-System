import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ApiError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { markRead } from "@/services/notifications";
import { markNotificationReadSchema } from "@/validators/notifications";

export const GET = route(async (req, ctx) => {
  const actor = await requirePermission("notifications:read");
  const { id } = await ctx.params;
  const notification = await db.notification.findFirst({ where: { id, userId: actor.id } });
  if (!notification) throw new ApiError(404, "Notification not found");
  return ok(notification);
});

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("notifications:read");
  const { id } = await ctx.params;
  const input = assertInput(markNotificationReadSchema, await req.json().catch(() => null));
  const notification = await markRead(actor.id, id, input.read);
  return ok(notification);
});
