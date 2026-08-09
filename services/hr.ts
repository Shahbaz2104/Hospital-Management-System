import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";

import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { nextSeq } from "@/lib/sequences";
import { logAudit } from "@/services/audit";
import type {
  attendanceMarkSchema,
  employeeSchema,
  employeeUpdateSchema,
  leaveDecisionSchema,
  leaveSchema,
  payrollGenerateSchema,
  performanceReviewSchema,
} from "@/validators/hr";

type Actor = { userId: string; hospitalId?: string | null };

const fmt = (n: number) => `$${n.toFixed(2)}`;

async function nextNumber(kind: "employee" | "leave"): Promise<string> {
  if (kind === "employee") return nextSeq(() => db.employee.findMany({ select: { employeeNo: true } }), "employeeNo", "EMP");
  return nextSeq(() => db.leave.findMany({ select: { leaveNo: true } }), "leaveNo", "LV");
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

const employeeInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, role: { select: { name: true, label: true } } } },
  department: { select: { id: true, name: true, code: true } },
} as const;

export async function listEmployees(
  filters: { search?: string; departmentId?: string; status?: string; page?: number; pageSize?: number; hospitalId?: string | null } = {}
) {
  const where: Record<string, unknown> = {};
  if (filters.hospitalId) where.hospitalId = filters.hospitalId;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.departmentId && filters.departmentId !== "ALL") where.departmentId = filters.departmentId;
  if (filters.search) {
    where.OR = [
      { employeeNo: { contains: filters.search, mode: "insensitive" } },
      { designation: { contains: filters.search, mode: "insensitive" } },
      { user: { firstName: { contains: filters.search, mode: "insensitive" } } },
      { user: { lastName: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

  const [items, total] = await Promise.all([
    db.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.employee.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function createEmployee(actor: Actor, input: z.infer<typeof employeeSchema>) {
  if (!input.password) throw new ApiError(400, "Password is required for a new employee");
  const role = await db.role.findUnique({ where: { name: input.roleName } });
  if (!role) throw new ApiError(400, `Unknown role: ${input.roleName}`);
  if (role.name === "SUPER_ADMIN" || role.name === "PATIENT") {
    throw new ApiError(400, `Cannot assign role ${role.name} to an employee`);
  }

  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw new ApiError(409, "A user with this email already exists");

  const employeeNo = await nextNumber("employee");
  const passwordHash = await hashPassword(input.password);

  const employee = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        title: input.designation ?? null,
        passwordHash,
        roleId: role.id,
        hospitalId: actor.hospitalId ?? null,
      },
    });
    return tx.employee.create({
      data: {
        userId: user.id,
        employeeNo,
        departmentId: input.departmentId || null,
        designation: input.designation ?? null,
        employmentType: input.employmentType,
        joiningDate: input.joiningDate ? new Date(input.joiningDate) : null,
        salary: input.salary,
        allowances: input.allowances,
        gender: input.gender ?? null,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        address: input.address ?? null,
        emergencyContact: input.emergencyContact ?? null,
        bankName: input.bankName ?? null,
        bankAccountNo: input.bankAccountNo ?? null,
        bankIfsc: input.bankIfsc ?? null,
        status: input.status,
        hospitalId: actor.hospitalId ?? null,
      },
    });
  });

  await logAudit({
    userId: actor.userId,
    action: "EMPLOYEE_CREATED",
    entity: "Employee",
    entityId: employee.id,
    meta: { employeeNo, email: input.email, role: role.name },
  });
  return employee;
}

export async function updateEmployee(actor: Actor, id: string, input: z.infer<typeof employeeUpdateSchema>) {
  const employee = await db.employee.findUnique({ where: { id }, include: { user: true } });
  if (!employee) throw new ApiError(404, "Employee not found");

  if (input.email && input.email !== employee.user.email) {
    const clash = await db.user.findUnique({ where: { email: input.email } });
    if (clash && clash.id !== employee.userId) throw new ApiError(409, "A user with this email already exists");
  }
  if (input.roleName) {
    const role = await db.role.findUnique({ where: { name: input.roleName } });
    if (!role) throw new ApiError(400, `Unknown role: ${input.roleName}`);
    if (role.name === "SUPER_ADMIN" || role.name === "PATIENT") {
      throw new ApiError(400, `Cannot assign role ${role.name} to an employee`);
    }
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: employee.userId },
      data: {
        firstName: input.firstName ?? employee.user.firstName,
        lastName: input.lastName ?? employee.user.lastName,
        email: input.email ?? employee.user.email,
        phone: input.phone === undefined ? employee.user.phone : (input.phone || null),
        title: input.designation === undefined ? employee.user.title : (input.designation || null),
        ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
        ...(input.roleName ? { role: { connect: { name: input.roleName } } } : {}),
      },
    });
    return tx.employee.update({
      where: { id },
      data: {
        departmentId: input.departmentId === undefined ? undefined : (input.departmentId || null),
        designation: input.designation ?? undefined,
        employmentType: input.employmentType ?? undefined,
        joiningDate: input.joiningDate ? new Date(input.joiningDate) : input.joiningDate === "" ? null : undefined,
        salary: input.salary ?? undefined,
        allowances: input.allowances ?? undefined,
        gender: input.gender ?? undefined,
        birthDate: input.birthDate ? new Date(input.birthDate) : input.birthDate === "" ? null : undefined,
        address: input.address ?? undefined,
        emergencyContact: input.emergencyContact ?? undefined,
        bankName: input.bankName ?? undefined,
        bankAccountNo: input.bankAccountNo ?? undefined,
        bankIfsc: input.bankIfsc ?? undefined,
        status: input.status ?? undefined,
      },
    });
  });

  await logAudit({
    userId: actor.userId,
    action: "EMPLOYEE_UPDATED",
    entity: "Employee",
    entityId: id,
    meta: { employeeNo: employee.employeeNo },
  });
  return updated;
}

export async function deleteEmployee(actor: Actor, id: string) {
  const employee = await db.employee.findUnique({ where: { id } });
  if (!employee) throw new ApiError(404, "Employee not found");

  await db.employee.delete({ where: { id } }); // cascades to user
  await logAudit({
    userId: actor.userId,
    action: "EMPLOYEE_DELETED",
    entity: "Employee",
    entityId: id,
    meta: { employeeNo: employee.employeeNo },
  });
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export async function listAttendance(filters: { month?: string; employeeId?: string; date?: string; hospitalId?: string | null } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.hospitalId) where.hospitalId = filters.hospitalId;
  if (filters.month) where.date = { startsWith: filters.month };
  if (filters.date) where.date = filters.date;
  if (filters.employeeId) where.employeeId = filters.employeeId;

  const items = await db.attendance.findMany({
    where,
    include: {
      employee: { include: { user: { select: { firstName: true, lastName: true, phone: true } }, department: { select: { name: true } } } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return items;
}

export async function markAttendance(actor: Actor, entries: z.infer<typeof attendanceMarkSchema>["entries"]) {
  const results = [];
  for (const entry of entries) {
    const employee = await db.employee.findUnique({ where: { id: entry.employeeId } });
    if (!employee) throw new ApiError(404, `Employee not found: ${entry.employeeId}`);

    const data = {
      status: entry.status,
      checkIn: entry.checkIn || null,
      checkOut: entry.checkOut || null,
      hoursWorked: entry.hoursWorked ?? null,
      notes: entry.notes ?? null,
      recordedById: actor.userId,
      hospitalId: actor.hospitalId ?? null,
    };
    const record = await db.attendance.upsert({
      where: { employeeId_date: { employeeId: entry.employeeId, date: entry.date } },
      update: data,
      create: { employeeId: entry.employeeId, date: entry.date, ...data },
    });
    results.push(record);
  }

  await logAudit({
    userId: actor.userId,
    action: "ATTENDANCE_MARKED",
    entity: "Attendance",
    meta: { count: results.length, dates: [...new Set(entries.map((e) => e.date))] },
  });
  return results;
}

export async function attendanceStats(month: string, hospitalId?: string | null) {
  const rows = await db.attendance.groupBy({
    by: ["employeeId", "status"],
    where: { date: { startsWith: month }, ...(hospitalId ? { hospitalId } : {}) },
    _count: { _all: true },
  });

  const counts = new Map<string, { PRESENT: number; ABSENT: number; HALF_DAY: number; LEAVE: number }>();
  for (const row of rows) {
    const entry = counts.get(row.employeeId) ?? { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0 };
    entry[row.status as keyof typeof entry] = row._count._all;
    counts.set(row.employeeId, entry);
  }

  const ids = [...counts.keys()];
  const employees = ids.length
    ? await db.employee.findMany({
        where: { id: { in: ids } },
        include: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } },
      })
    : [];

  return employees.map((e) => ({
    employeeId: e.id,
    employeeNo: e.employeeNo,
    name: `${e.user.firstName} ${e.user.lastName}`,
    department: e.department?.name ?? null,
    ...counts.get(e.id),
  }));
}

// ---------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------

const leaveInclude = {
  employee: { include: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } } },
  approver: { select: { firstName: true, lastName: true } },
} as const;

export async function listLeaves(filters: { status?: string; search?: string; hospitalId?: string | null } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.hospitalId) where.hospitalId = filters.hospitalId;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { leaveNo: { contains: filters.search, mode: "insensitive" } },
      { employee: { user: { firstName: { contains: filters.search, mode: "insensitive" } } } },
      { employee: { user: { lastName: { contains: filters.search, mode: "insensitive" } } } },
    ];
  }

  const items = await db.leave.findMany({
    where,
    include: leaveInclude,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return items;
}

export async function createLeave(actor: Actor, input: z.infer<typeof leaveSchema>) {
  const employee = await db.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw new ApiError(404, "Employee not found");

  const from = new Date(input.fromDate + "T00:00:00");
  const to = new Date(input.toDate + "T00:00:00");
  if (to < from) throw new ApiError(400, "End date must be on or after the start date");

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  const leave = await db.leave.create({
    data: {
      leaveNo: await nextNumber("leave"),
      employeeId: input.employeeId,
      type: input.type,
      fromDate: from,
      toDate: to,
      days,
      reason: input.reason,
      notes: input.notes ?? null,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  await logAudit({
    userId: actor.userId,
    action: "LEAVE_CREATED",
    entity: "Leave",
    entityId: leave.id,
    meta: { leaveNo: leave.leaveNo, days },
  });
  return leave;
}

export async function decideLeave(actor: Actor, id: string, input: z.infer<typeof leaveDecisionSchema>) {
  const leave = await db.leave.findUnique({ where: { id } });
  if (!leave) throw new ApiError(404, "Leave not found");
  if (leave.status !== "PENDING") throw new ApiError(409, "Only pending leaves can be decided");

  const updated = await db.leave.update({
    where: { id },
    data: { status: input.status, approverId: actor.userId, decidedAt: new Date(), notes: input.notes ?? leave.notes },
  });

  await logAudit({
    userId: actor.userId,
    action: "LEAVE_DECIDED",
    entity: "Leave",
    entityId: id,
    meta: { leaveNo: leave.leaveNo, status: input.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Performance reviews
// ---------------------------------------------------------------------------

export async function listReviews(filters: { employeeId?: string; hospitalId?: string | null } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.hospitalId) where.hospitalId = filters.hospitalId;
  if (filters.employeeId) where.employeeId = filters.employeeId;

  return db.performanceReview.findMany({
    where,
    include: {
      employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      reviewer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function createReview(actor: Actor, input: z.infer<typeof performanceReviewSchema>) {
  const employee = await db.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw new ApiError(404, "Employee not found");

  const review = await db.performanceReview.create({
    data: {
      employeeId: input.employeeId,
      period: input.period,
      rating: input.rating,
      strengths: input.strengths ?? null,
      improvements: input.improvements ?? null,
      goals: input.goals ?? null,
      reviewerId: actor.userId,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  await logAudit({
    userId: actor.userId,
    action: "PERFORMANCE_REVIEW_CREATED",
    entity: "PerformanceReview",
    entityId: review.id,
    meta: { period: input.period, rating: input.rating },
  });
  return review;
}

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

const payrollInclude = {
  employee: {
    include: {
      user: { select: { firstName: true, lastName: true } },
      department: { select: { name: true } },
    },
  },
} as const;

export async function generatePayroll(actor: Actor, input: z.infer<typeof payrollGenerateSchema>) {
  if (!/^\d{4}-\d{2}$/.test(input.month)) throw new ApiError(400, "Month must be YYYY-MM");

  const overrides = new Map<string, { bonus?: number; overtime?: number; deductions?: number; notes?: string | null }>(
    (input.overrides ?? []).map((o) => [o.employeeId, o])
  );
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, salary: true, allowances: true },
  });

  const existing = await db.payroll.findMany({
    where: { month: input.month, employeeId: { in: employees.map((e) => e.id) } },
    select: { employeeId: true },
  });
  const existingIds = new Set(existing.map((p) => p.employeeId));

  const rows = employees
    .filter((e) => !existingIds.has(e.id))
    .map((e) => {
      const o = overrides.get(e.id) ?? {};
      const basicSalary = e.salary;
      const allowances = e.allowances;
      const bonus = o.bonus ?? 0;
      const overtime = o.overtime ?? 0;
      const deductions = o.deductions ?? 0;
      const netPay = Math.max(0, Math.round((basicSalary + allowances + bonus + overtime - deductions) * 100) / 100);
      return {
        employeeId: e.id,
        month: input.month,
        basicSalary,
        allowances,
        bonus,
        overtime,
        deductions,
        netPay,
        notes: o.notes ?? null,
        hospitalId: actor.hospitalId ?? null,
      };
    });

  let created = 0;
  if (rows.length) {
    await db.payroll.createMany({ data: rows });
    created = rows.length;
  }

  await logAudit({
    userId: actor.userId,
    action: "PAYROLL_GENERATED",
    entity: "Payroll",
    meta: { month: input.month, created, skipped: existingIds.size },
  });
  return { month: input.month, created, skipped: existingIds.size };
}

export async function listPayroll(filters: { month?: string; status?: string; search?: string; hospitalId?: string | null } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.hospitalId) where.hospitalId = filters.hospitalId;
  if (filters.month && filters.month !== "ALL") where.month = filters.month;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { employee: { user: { firstName: { contains: filters.search, mode: "insensitive" } } } },
      { employee: { user: { lastName: { contains: filters.search, mode: "insensitive" } } } },
      { employee: { employeeNo: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const items = await db.payroll.findMany({
    where,
    include: payrollInclude,
    orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return items;
}

export async function payrollStats(month: string, hospitalId?: string | null) {
  const rows = await db.payroll.groupBy({
    by: ["status"],
    where: { month, ...(hospitalId ? { hospitalId } : {}) },
    _count: { _all: true },
    _sum: { netPay: true },
  });

  const stats = { total: 0, paid: 0, pending: 0, amountTotal: 0, amountPaid: 0, amountPending: 0 };
  for (const row of rows) {
    const amount = row._sum.netPay ?? 0;
    stats.total += row._count._all;
    stats.amountTotal += amount;
    if (row.status === "PAID") {
      stats.paid += row._count._all;
      stats.amountPaid += amount;
    } else {
      stats.pending += row._count._all;
      stats.amountPending += amount;
    }
  }
  return stats;
}

export async function markPayrollPaid(actor: Actor, ids: string[]) {
  const result = await db.payroll.updateMany({
    where: { id: { in: ids }, status: "GENERATED" },
    data: { status: "PAID", paidAt: new Date(), paidById: actor.userId },
  });

  await logAudit({
    userId: actor.userId,
    action: "PAYROLL_MARKED_PAID",
    entity: "Payroll",
    meta: { count: result.count },
  });
  return { count: result.count };
}

export async function buildPayslipPdf(payrollId: string): Promise<Uint8Array> {
  const payroll = await db.payroll.findUnique({
    where: { id: payrollId },
    include: payrollInclude,
  });
  if (!payroll) throw new ApiError(404, "Payroll record not found");

  const hospital = await db.hospital.findFirst();
  const hospitalName = hospital?.name ?? "City Care Hospital";

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4 portrait
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const gray = rgb(0.42, 0.45, 0.5);
  const blue = rgb(0.15, 0.39, 0.92);
  const dark = rgb(0.1, 0.11, 0.13);

  let y = 800;

  page.drawText(hospitalName.toUpperCase(), { x: 48, y, size: 18, font: bold, color: blue });
  page.drawText(`PAYSLIP — ${payroll.month}`, { x: 48, y: y - 26, size: 11, font: font, color: gray });
  page.drawText(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`, { x: 48, y: y - 42, size: 9, font: font, color: gray });
  page.drawRectangle({ x: 48, y: y - 56, width: 499, height: 1, color: rgb(0.88, 0.9, 0.93) });

  y -= 88;

  const emp = payroll.employee;
  const name = `${emp.user.firstName} ${emp.user.lastName}`;
  const label = (text: string) => page.drawText(text, { x: 48, y, size: 9, font: font, color: gray });
  const value = (text: string, x = 200) => page.drawText(text, { x, y, size: 10, font: font, color: dark });

  label("EMPLOYEE"); value(name);
  y -= 18;
  label("EMPLOYEE NO."); value(emp.employeeNo);
  y -= 18;
  label("DEPARTMENT"); value(emp.department?.name ?? "—");
  y -= 18;
  label("DESIGNATION"); value(emp.designation ?? "—");
  y -= 18;
  label("PAY PERIOD"); value(payroll.month);
  y -= 30;

  page.drawRectangle({ x: 48, y: y - 6, width: 499, height: 1, color: rgb(0.88, 0.9, 0.93) });
  y -= 18;

  const row = (nameText: string, amount: number, boldRow = false) => {
    page.drawText(nameText, { x: 48, y, size: 10, font: boldRow ? bold : font, color: dark });
    page.drawText(fmt(amount), { x: 470, y, size: 10, font: boldRow ? bold : font, color: dark });
    y -= 20;
  };

  page.drawText("EARNINGS", { x: 48, y, size: 9, font: bold, color: blue });
  y -= 18;
  row("Basic salary", payroll.basicSalary);
  if (payroll.allowances > 0) row("Allowances", payroll.allowances);
  if (payroll.bonus > 0) row("Bonus", payroll.bonus);
  if (payroll.overtime > 0) row("Overtime", payroll.overtime);

  y -= 6;
  page.drawText("DEDUCTIONS", { x: 48, y, size: 9, font: bold, color: blue });
  y -= 18;
  row("Total deductions", payroll.deductions);

  y -= 6;
  page.drawRectangle({ x: 48, y: y - 4, width: 499, height: 1, color: rgb(0.88, 0.9, 0.93) });
  y -= 22;
  row("NET PAY", payroll.netPay, true);
  y -= 8;
  page.drawText(`STATUS: ${payroll.status}${payroll.paidAt ? ` · paid ${payroll.paidAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}` : ""}`, { x: 48, y, size: 9, font: bold, color: payroll.status === "PAID" ? rgb(0.09, 0.58, 0.32) : rgb(0.83, 0.55, 0.1) });

  if (payroll.notes) {
    y -= 26;
    page.drawText("NOTES", { x: 48, y, size: 9, font: bold, color: gray });
    y -= 16;
    page.drawText(payroll.notes, { x: 48, y, size: 9, font: font, color: gray });
  }

  return doc.save();
}
