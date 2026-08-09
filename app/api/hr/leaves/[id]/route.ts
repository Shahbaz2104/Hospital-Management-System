import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ApiError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { decideLeave } from "@/services/hr";
import { leaveDecisionSchema } from "@/validators/hr";

export const GET = route(async (req, ctx) => {
  await requirePermission("hr:read");
  const { id } = await ctx.params;
  const leave = await db.leave.findUnique({
    where: { id },
    include: {
      employee: { include: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } } },
      approver: { select: { firstName: true, lastName: true } },
    },
  });
  if (!leave) throw new ApiError(404, "Leave not found");
  return ok(leave);
});

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("hr:manage");
  const { id } = await ctx.params;
  const input = assertInput(leaveDecisionSchema, await req.json().catch(() => null));
  const leave = await decideLeave({ userId: actor.id, hospitalId: actor.hospitalId }, id, input);
  return ok(leave);
});
