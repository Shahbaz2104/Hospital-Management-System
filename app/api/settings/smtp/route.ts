import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { updateSmtpSettings } from "@/services/settings";
import { smtpSettingsSchema } from "@/validators/settings";

export const PATCH = route(async (req) => {
  const actor = await requirePermission("settings:manage");
  const input = assertInput(smtpSettingsSchema, await req.json());
  return ok(await updateSmtpSettings(actor, input));
});
