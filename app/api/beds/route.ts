import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { db } from "@/lib/db";

export const GET = route(async () => {
  await requirePermission("admissions:read");

  const beds = await db.bed.findMany({
    include: { room: { select: { number: true, type: true } } },
    orderBy: { number: "asc" },
  });

  return ok({
    items: beds.map((b) => ({
      id: b.id,
      number: b.number,
      status: b.status,
      patientId: b.patientId,
      room: b.room,
    })),
  });
});
