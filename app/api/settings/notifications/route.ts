import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { updateNotificationSettings } from "@/services/settings";
import { notificationSettingsSchema } from "@/validators/settings";

export const PATCH = route(async (req) => {
  const actor = await requirePermission("settings:manage");
  const input = assertInput(notificationSettingsSchema, await req.json().catch(() => null));
  return ok(await updateNotificationSettings(actor, input));
});
