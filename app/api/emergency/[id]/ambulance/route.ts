import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { dispatchAmbulance } from "@/services/emergency";
import { ambulanceDispatchSchema } from "@/validators/emergency";

export const POST = route(async (req, ctx) => {
  const actor = await requirePermission("emergency:manage");
  const { id } = await ctx.params;
  const input = assertInput(ambulanceDispatchSchema, await req.json().catch(() => null));
  return ok(await dispatchAmbulance(actor, id, input));
});
