import { db } from "@/lib/db";

const MS_DAY = 86_400_000;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function analyticsOverview() {
  const now = new Date();

  // ---- Last 6 months: revenue (payments) + new patients + appointments
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [payments, patients, appointments] = await Promise.all([
    db.payment.findMany({
      where: { paidAt: { gte: sixMonthsAgo }, amount: { gt: 0 } },
      select: { amount: true, paidAt: true, method: true },
    }),
    db.patient.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    db.appointment.findMany({
      where: { date: { gte: sixMonthsAgo } },
      select: { date: true, status: true },
    }),
  ]);

  const revenueByMonth = new Map(months.map((m) => [m, 0]));
  for (const p of payments) revenueByMonth.set(monthKey(p.paidAt), (revenueByMonth.get(monthKey(p.paidAt)) ?? 0) + p.amount);

  const patientsByMonth = new Map(months.map((m) => [m, 0]));
  for (const p of patients) patientsByMonth.set(monthKey(p.createdAt), (patientsByMonth.get(monthKey(p.createdAt)) ?? 0) + 1);

  const appointmentsByMonth = new Map(months.map((m) => [m, 0]));
  for (const a of appointments) appointmentsByMonth.set(monthKey(a.date), (appointmentsByMonth.get(monthKey(a.date)) ?? 0) + 1);

  const monthly = months.map((m) => ({
    month: m,
    revenue: Math.round((revenueByMonth.get(m) ?? 0) * 100) / 100,
    patients: patientsByMonth.get(m) ?? 0,
    appointments: appointmentsByMonth.get(m) ?? 0,
  }));

  const revenueTotal = monthly.reduce((s, m) => s + m.revenue, 0);
  const last = monthly[monthly.length - 1]?.revenue ?? 0;
  const prev = monthly[monthly.length - 2]?.revenue ?? 0;
  const growthPct = prev > 0 ? ((last - prev) / prev) * 100 : 0;

  const methodTotals: Record<string, number> = {};
  for (const p of payments) methodTotals[p.method] = (methodTotals[p.method] ?? 0) + p.amount;
  const paymentMethods = Object.entries(methodTotals).map(([method, amount]) => ({
    method,
    amount: Math.round(amount * 100) / 100,
  }));

  // ---- Doctor performance (top 8 by appointments)
  const apptGroups = await db.appointment.groupBy({
    by: ["doctorId"],
    where: { date: { gte: sixMonthsAgo } },
    _count: { _all: true },
    orderBy: { _count: { doctorId: "desc" } },
    take: 8,
  });
  const doctorIds = apptGroups.map((g) => g.doctorId).filter((id): id is string => id !== null);
  const doctorNames = new Map<string, string>();
  if (doctorIds.length) {
    const docs = await db.doctor.findMany({
      where: { id: { in: doctorIds } },
      include: { user: { select: { firstName: true, lastName: true, title: true } } },
    });
    for (const d of docs) doctorNames.set(d.id, `${d.user.title ? d.user.title + " " : ""}${d.user.firstName} ${d.user.lastName}`);
  }
  const doctorPerformance = apptGroups.map((g) => ({
    doctor: g.doctorId ? (doctorNames.get(g.doctorId) ?? "Unassigned") : "Unassigned",
    appointments: g._count._all,
  }));

  // ---- Bed utilization + occupancy trend (14 days)
  const [bedGroups, rooms] = await Promise.all([
    db.bed.groupBy({ by: ["status"], _count: { _all: true } }),
    db.room.findMany({ select: { id: true, ratePerDay: true, type: true } }),
  ]);
  const beds = bedGroups.map((g) => ({ status: g.status, count: g._count._all }));
  const totalBeds = beds.reduce((s, b) => s + b.count, 0);
  const occupied = beds.find((b) => b.status === "OCCUPIED")?.count ?? 0;

  const occupancyTrend: { date: string; occupied: number; available: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + MS_DAY - 1);
    const count = await db.admission.count({
      where: {
        admittedAt: { lte: dayEnd },
        OR: [{ dischargeAt: null }, { dischargeAt: { gte: dayStart } }],
      },
    });
    occupancyTrend.push({
      date: `${String(dayStart.getMonth() + 1).padStart(2, "0")}/${String(dayStart.getDate()).padStart(2, "0")}`,
      occupied: Math.min(count, totalBeds),
      available: Math.max(0, totalBeds - count),
    });
  }

  // ---- Medicine usage (last 30 days, top 8 by units)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_DAY);
  const sales = await db.medicineSale.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { items: true },
    take: 500,
  });
  const usage = new Map<string, { qty: number; revenue: number }>();
  for (const sale of sales) {
    let items: { medicineId?: string; name?: string; quantity?: number; unitPrice?: number }[] = [];
    try {
      items = JSON.parse(sale.items);
    } catch {}
    for (const it of items) {
      const id = it.medicineId ?? it.name ?? "other";
      const qty = Number(it.quantity ?? 1);
      const cur = usage.get(id) ?? { qty: 0, revenue: 0 };
      usage.set(id, { qty: cur.qty + qty, revenue: cur.revenue + qty * Number(it.unitPrice ?? 0) });
    }
  }
  const medicineIds = [...usage.keys()].filter((id) => id.length === 24);
  const medicineNames = new Map<string, string>();
  if (medicineIds.length) {
    const meds = await db.medicine.findMany({ where: { id: { in: medicineIds } }, select: { id: true, name: true } });
    for (const m of meds) medicineNames.set(m.id, m.name);
  }
  const medicineUsage = [...usage.entries()]
    .map(([id, u]) => ({ medicine: medicineNames.get(id) ?? id, ...u }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  // ---- Appointment status split (all time recent 6 months)
  const statusCounts: Record<string, number> = {};
  for (const a of appointments) statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  const appointmentStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  return {
    monthly,
    revenueTotal,
    growthPct: Math.round(growthPct * 10) / 10,
    paymentMethods,
    doctorPerformance,
    beds,
    totalBeds,
    occupiedBeds: occupied,
    occupancyRate: totalBeds ? Math.round((occupied / totalBeds) * 100) : 0,
    occupancyTrend,
    medicineUsage,
    appointmentStatus,
    roomCapacity: rooms.length,
    capacityValue: rooms.reduce((s, r) => s + r.ratePerDay, 0),
  };
}
