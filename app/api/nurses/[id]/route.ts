import { requirePermission } from "@/lib/auth/guards";
import { ApiError, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { deleteNurse } from "@/services/master-data";

export const GET = route(async (req, ctx) => {
  await requirePermission("nurses:read");
  const { id } = await ctx.params;
  const nurse = await db.nurse.findUnique({
    where: { id },
    include: { user: { select: { firstName: true, lastName: true, email: true, phone: true, title: true } } },
  });
  if (!nurse) throw new ApiError(404, "Nurse not found");
  return ok(nurse);
});

export const DELETE = route(async (req, ctx) => {
  const actor = await requirePermission("nurses:manage");
  const { id } = await ctx.params;
  await deleteNurse({ userId: actor.id, hospitalId: actor.hospitalId }, id);
  await logAudit({
    userId: actor.id,
    action: "NURSE_DELETED",
    entity: "Nurse",
    entityId: id,
    ipAddress: getIp(req),
  });
  return ok({ deleted: true });
});