import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { getSettingsOverview, updateHospitalSettings } from "@/services/settings";
import { hospitalSettingsSchema } from "@/validators/settings";

export const GET = route(async () => {
  await requirePermission("settings:manage");
  return ok(await getSettingsOverview());
});

export const PATCH = route(async (req) => {
  const actor = await requirePermission("settings:manage");
  const input = assertInput(hospitalSettingsSchema, await req.json());
  return ok(await updateHospitalSettings(actor, input));
});
