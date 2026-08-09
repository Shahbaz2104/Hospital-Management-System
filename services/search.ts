import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/can";

/**
 * Global search across the most-used records. Each result keeps the same
 * shape { id, label, sub, href } so the search modal renders uniformly.
 *
 * Collections are gated by the actor's permissions (no cross-role PII leak)
 * and PATIENT actors only ever see their own records.
 */
export async function globalSearch(
  query: string,
  opts: { limit?: number; user?: SessionUser } = {}
) {
  const q = query.trim();
  if (q.length < 2) return { items: [], total: 0 };
  const limit = Math.min(Math.max(1, opts.limit ?? 8), 10);
  const user = opts.user;

  // PATIENT actors resolve to their own patient record + appointments.
  let ownPatientId: string | null = null;
  if (user?.roleName === "PATIENT") {
    const own = await db.patient.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    ownPatientId = own?.id ?? null;
  }

  const nameContains = (field: string) => ({ contains: q });
  const canSee = (permission: Parameters<typeof can>[1]) => (user ? can(user, permission) : true);

  const searches: Promise<unknown[]>[] = [];

  const patientsPromise = (async () => {
    if (!canSee("patients:read")) return [];
    const where: Record<string, unknown> = ownPatientId
      ? { id: ownPatientId }
      : {
          OR: [
            { firstName: nameContains(q) },
            { lastName: nameContains(q) },
            { patientNo: nameContains(q) },
            { phone: nameContains(q) },
          ],
        };
    return db.patient.findMany({
      where,
      select: { id: true, patientNo: true, firstName: true, lastName: true, gender: true },
      take: limit,
    });
  })();

  const doctorsPromise = (async () => {
    if (!canSee("doctors:read")) return [];
    return db.doctor.findMany({
      where: {
        OR: [
          { user: { firstName: nameContains(q) } },
          { user: { lastName: nameContains(q) } },
          { specialization: nameContains(q) },
          { licenseNumber: nameContains(q) },
        ],
      },
      select: {
        id: true,
        user: { select: { title: true, firstName: true, lastName: true } },
        specialization: true,
        department: { select: { name: true } },
      },
      take: limit,
    });
  })();

  const appointmentsPromise = (async () => {
    if (!canSee("appointments:read")) return [];
    const where: Record<string, unknown> = {
      OR: [
        { tokenNo: nameContains(q) },
        { patient: { firstName: nameContains(q) } },
        { patient: { lastName: nameContains(q) } },
      ],
    };
    if (ownPatientId) where.patientId = ownPatientId;
    return db.appointment.findMany({
      where,
      select: {
        id: true,
        tokenNo: true,
        date: true,
        status: true,
        patient: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  })();

  const medicinesPromise = (async () => {
    if (!canSee("pharmacy:read")) return [];
    return db.medicine.findMany({
      where: { OR: [{ name: nameContains(q) }, { genericName: nameContains(q) }, { barcode: nameContains(q) }] },
      select: { id: true, name: true, genericName: true, stock: true },
      take: limit,
    });
  })();

  const departmentsPromise = (async () => {
    if (!canSee("departments:read")) return [];
    return db.department.findMany({
      where: { OR: [{ name: nameContains(q) }, { code: nameContains(q) }] },
      select: { id: true, name: true, code: true },
      take: limit,
    });
  })();

  const employeesPromise = (async () => {
    if (!canSee("hr:read")) return [];
    return db.employee.findMany({
      where: {
        OR: [
          { employeeNo: nameContains(q) },
          { user: { firstName: nameContains(q) } },
          { user: { lastName: nameContains(q) } },
          { designation: nameContains(q) },
        ],
      },
      select: { id: true, employeeNo: true, designation: true, user: { select: { firstName: true, lastName: true } } },
      take: limit,
    });
  })();

  const [patients, doctors, appointments, medicines, departments, employees] =
    await Promise.all([
      patientsPromise,
      doctorsPromise,
      appointmentsPromise,
      medicinesPromise,
      departmentsPromise,
      employeesPromise,
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
