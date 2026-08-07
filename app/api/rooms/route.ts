import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { insensitiveContains, parseListParams } from "@/lib/pagination";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { createRoom } from "@/services/master-data";
import { roomSchema } from "@/validators/master-data";

export const GET = route(async (req: Request) => {
  await requirePermission("rooms:read");

  const url = new URL(req.url);
  const { page, pageSize, search } = parseListParams(url);

  const where = search
    ? {
        OR: [
          insensitiveContains("number", search),
          insensitiveContains("name", search),
        ],
      }
    : {};

  const [total, rooms] = await Promise.all([
    db.room.count({ where }),
    db.room.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        beds: { orderBy: { number: "asc" } },
        _count: { select: { beds: true } },
      },
      orderBy: { floor: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    items: rooms,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("rooms:manage");
  const input = assertInput(roomSchema, await req.json().catch(() => null));

  const room = await createRoom(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "ROOM_CREATED",
    entity: "Room",
    entityId: room.id,
    meta: { number: room.number },
    ipAddress: getIp(req),
  });
  return ok(room, { status: 201 });
});