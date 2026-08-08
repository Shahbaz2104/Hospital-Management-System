import { db } from "@/lib/db";

/**
 * Global search across the most-used records. Each result keeps the same
 * shape { id, label, sub, href } so the search modal renders uniformly.
 */
export async function globalSearch(query: string, opts: { limit?: number } = {}) {
  const q = query.trim();
  if (q.length < 2) return { items: [], total: 0 };
  const limit = opts.limit ?? 8;

  const [patients, doctors, appointments, medicines, departments, employees] = await Promise.all([
    db.patient.findMany({
      where: {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { patientNo: { contains: q } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, patientNo: true, firstName: true, lastName: true, gender: true },
      take: limit,
    }),
    db.doctor.findMany({
      where: {
        OR: [
          { user: { firstName: { contains: q } } },
          { user: { lastName: { contains: q } } },
          { specialization: { contains: q } },
          { licenseNumber: { contains: q } },
        ],
      },
      select: {
        id: true,
        user: { select: { title: true, firstName: true, lastName: true } },
        specialization: true,
        department: { select: { name: true } },
      },
      take: limit,
    }),
    db.appointment.findMany({
      where: {
        OR: [
          { tokenNo: { contains: q } },
          { patient: { firstName: { contains: q } } },
          { patient: { lastName: { contains: q } } },
        ],
      },
      select: {
        id: true,
        tokenNo: true,
        date: true,
        status: true,
        patient: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.medicine.findMany({
      where: { OR: [{ name: { contains: q } }, { genericName: { contains: q } }, { barcode: { contains: q } }] },
      select: { id: true, name: true, genericName: true, stock: true },
      take: limit,
    }),
    db.department.findMany({
      where: { OR: [{ name: { contains: q } }, { code: { contains: q } }] },
      select: { id: true, name: true, code: true },
      take: limit,
    }),
    db.employee.findMany({
      where: {
        OR: [
          { employeeNo: { contains: q } },
          { user: { firstName: { contains: q } } },
          { user: { lastName: { contains: q } } },
          { designation: { contains: q } },
        ],
      },
      select: { id: true, employeeNo: true, designation: true, user: { select: { firstName: true, lastName: true } } },
      take: limit,
    }),
  ]);

  const items: Array<{ id: string; label: string; sub: string; href: string }> = [
    ...patients.map((p) => ({
      id: `p-${p.id}`,
      label: `${p.firstName} ${p.lastName}`,
      sub: `Patient · ${p.patientNo}${p.gender ? ` · ${p.gender}` : ""}`,
      href: `/patients/${p.id}`,
    })),
    ...doctors.map((d) => ({
      id: `d-${d.id}`,
      label: `${d.user.title ? `${d.user.title} ` : ""}${d.user.firstName} ${d.user.lastName}`,
      sub: `Doctor · ${d.specialization ?? d.department?.name ?? "General"}`,
      href: "/doctors",
    })),
    ...appointments.map((a) => ({
      id: `a-${a.id}`,
      label: `${a.patient.firstName} ${a.patient.lastName}`,
      sub: `Appointment · ${a.tokenNo} · ${new Date(a.date).toLocaleDateString()} · ${a.status}`,
      href: "/appointments",
    })),
    ...medicines.map((m) => ({
      id: `m-${m.id}`,
      label: m.name,
      sub: `Medicine · ${m.genericName ?? "—"} · stock ${m.stock}`,
      href: "/pharmacy",
    })),
    ...departments.map((dep) => ({
      id: `dep-${dep.id}`,
      label: dep.name,
      sub: `Department · ${dep.code}`,
      href: "/departments",
    })),
    ...employees.map((e) => ({
      id: `e-${e.id}`,
      label: `${e.user.firstName} ${e.user.lastName}`,
      sub: `Staff · ${e.employeeNo} · ${e.designation ?? "—"}`,
      href: "/staff",
    })),
  ];

  return { items, total: items.length };
}
