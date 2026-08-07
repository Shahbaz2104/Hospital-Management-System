import { requirePermission } from "@/lib/auth/guards";
import { getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { deleteNurse } from "@/services/master-data";

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