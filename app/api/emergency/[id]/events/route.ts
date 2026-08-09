import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { addEvent, listEvents } from "@/services/emergency";
import { emergencyEventSchema } from "@/validators/emergency";

export const GET = route(async (req, ctx) => {
  await requirePermission("emergency:read");
  const { id } = await ctx.params;
  return ok(await listEvents(id));
});

export const POST = route(async (req, ctx) => {
  const actor = await requirePermission("emergency:manage");
  const { id } = await ctx.params;
  const input = assertInput(emergencyEventSchema, await req.json().catch(() => null));
  return ok(await addEvent(actor, id, input));
});
