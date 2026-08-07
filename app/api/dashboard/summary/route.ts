import { requirePermission } from "@/lib/auth/guards";
import { ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import type { PermissionKey } from "@/constants/permissions";

export const GET = route(async () => {
  const actor = await requirePermission("dashboard:read");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  const perm = (key: PermissionKey) =>
    actor.permissions.some((p) => p === "*" || p === key);

  const [
    patients,
    doctors,
    nurses,
    appointmentsToday,
    rooms,
    beds,
  ] = await Promise.all([
    perm("patients:read") ? db.patient.count() : Promise.resolve(null),
    perm("doctors:read")
      ? db.doctor.count({ where: { available: true } })
      : Promise.resolve(null),
    perm("nurses:read") ? db.nurse.count() : Promise.resolve(null),
    perm("appointments:read")
      ? db.appointment.count({
          where: { date: { gte: startOfDay, lte: endOfDay } },
        })
      : Promise.resolve(null),
    perm("rooms:read") ? db.room.count() : Promise.resolve(null),
    perm("rooms:read")
      ? db.bed.groupBy({ by: ["status"], _count: { _all: true } })
      : Promise.resolve(null),
  ]);

  const bedByStatus: Record<string, number> = {};
  if (beds) {
    for (const row of beds) {
      bedByStatus[row.status] = (bedByStatus[row.status] ?? 0) + row._count._all;
    }
  }

  const totalBeds = perm("rooms:read")
    ? Object.values(bedByStatus).reduce((a, b) => a + b, 0)
    : 0;

  const todayAppointments = perm("appointments:read")
    ? await db.appointment.findMany({
        where: { date: { gte: startOfDay, lte: endOfDay } },
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true, patientNo: true },
          },
          doctor: {
            include: {
              user: { select: { title: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 8,
      })
    : [];

  const trendStart = new Date(startOfDay);
  trendStart.setDate(trendStart.getDate() - 6);
  const trendGroups = perm("appointments:read")
    ? await db.appointment.groupBy({
        by: ["date"],
        where: { date: { gte: trendStart, lte: endOfDay } },
        _count: { _all: true },
      })
    : [];
  const trendMap = new Map(
    trendGroups.map((g) => [g.date.getTime(), g._count._all])
  );
  const appointmentsTrend = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(trendStart);
    d.setDate(trendStart.getDate() + i);
    return { date: d.toISOString(), count: trendMap.get(d.getTime()) ?? 0 };
  });

  const statusGroups = perm("appointments:read")
    ? await db.appointment.groupBy({
        by: ["status"],
        where: { date: { gte: startOfDay, lte: endOfDay } },
        _count: { _all: true },
      })
    : [];
  const appointmentsByStatus = statusGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
  }));

  return ok({
    stats: {
      patients,
      doctors,
      nurses,
      appointmentsToday,
      rooms,
      totalBeds,
      occupiedBeds: bedByStatus.OCCUPIED ?? 0,
      availableBeds: bedByStatus.AVAILABLE ?? 0,
    },
    upcoming: todayAppointments,
    appointmentsTrend,
    appointmentsByStatus,
    beds: Object.entries(bedByStatus).map(([status, count]) => ({ status, count })),
  });
});