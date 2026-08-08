import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { decideLeave } from "@/services/hr";
import { leaveDecisionSchema } from "@/validators/hr";

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("hr:manage");
  const { id } = await ctx.params;
  const input = assertInput(leaveDecisionSchema, await req.json());
  const leave = await decideLeave({ userId: actor.id, hospitalId: actor.hospitalId }, id, input);
  return ok(leave);
});
