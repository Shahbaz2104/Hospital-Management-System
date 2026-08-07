import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { updateRoom } from "@/services/master-data";
import { roomSchema } from "@/validators/master-data";

export const PATCH = route(async (req: Request, ctx) => {
  const actor = await requirePermission("rooms:manage");
  const { id } = await ctx.params;
  const input = assertInput(roomSchema.partial(), await req.json().catch(() => null));

  const room = await updateRoom(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id,
    input
  );
  await logAudit({
    userId: actor.id,
    action: "ROOM_UPDATED",
    entity: "Room",
    entityId: id,
    ipAddress: getIp(req),
  });
  return ok(room);
});