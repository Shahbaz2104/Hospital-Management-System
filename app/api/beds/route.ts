import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { db } from "@/lib/db";

export const GET = route(async () => {
  await requirePermission("admissions:read");

  const beds = await db.bed.findMany({
    include: {
      room: { select: { number: true, type: true } },
      admissions: {
        where: { status: { in: ["ADMITTED", "TRANSFERRED"] } },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, patientNo: true } },
        },
        take: 1,
      },
    },
    orderBy: { number: "asc" },
  });

  return ok({
    items: beds.map((b) => ({
      id: b.id,
      number: b.number,
      status: b.status,
      patientId: b.patientId,
      room: b.room,
      patient: b.admissions[0]?.patient ?? null,
    })),
  });
});
