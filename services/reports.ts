import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";

export type ReportColumn = { key: string; label: string; align?: "left" | "right" };
export type ReportRow = Record<string, string | number | null>;
export type ReportSummaryItem = { label: string; value: string | number };
export type ReportResult = {
  type: string;
  title: string;
  from?: string;
  to?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary: ReportSummaryItem[];
};

const fmt = (n: number) => `$${n.toFixed(2)}`;

function range(from?: string, to?: string) {
  const start = from ? new Date(`${from}T00:00:00`) : new Date(0);
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
  return { start, end };
}

export const REPORT_TYPES = [
  "patients",
  "revenue",
  "doctors",
  "appointments",
  "medicines",
  "inventory",
  "admissions",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export async function runReport(type: ReportType, opts: { from?: string; to?: string } = {}): Promise<ReportResult> {
  const { start, end } = range(opts.from, opts.to);
  const dateFilter = { gte: start, lte: end };
  const base = { type, from: opts.from, to: opts.to };

  switch (type) {
    case "patients": {
      const [patients, totalPatients, genderGroups] = await Promise.all([
        db.patient.findMany({
          where: { createdAt: dateFilter },
          include: { _count: { select: { appointments: true } } },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        db.patient.count({ where: { createdAt: dateFilter } }),
        db.patient.groupBy({
          by: ["gender"],
          where: { createdAt: dateFilter },
          _count: { _all: true },
        }),
      ]);
      const genderCounts: Record<string, number> = {};
      for (const g of genderGroups) {
        genderCounts[g.gender ?? "UNKNOWN"] = g._count._all;
      }
      const genderLabel = (g: string) =>
        g === "MALE" ? "Male" : g === "FEMALE" ? "Female" : g === "OTHER" ? "Other" : "Unknown";
      return {
        ...base,
        title: "Patient report",
        columns: [
          { key: "patientNo", label: "Patient no." },
          { key: "name", label: "Name" },
          { key: "gender", label: "Gender" },
          { key: "phone", label: "Phone" },
          { key: "bloodGroup", label: "Blood group" },
          { key: "registered", label: "Registered" },
          { key: "appointments", label: "Appointments", align: "right" },
        ],
        rows: patients.map((p) => ({
          patientNo: p.patientNo,
          name: `${p.firstName} ${p.lastName}`,
          gender: genderLabel(p.gender ?? "UNKNOWN"),
          phone: p.phone ?? "—",
          bloodGroup: p.bloodGroup ?? "—",
          registered: p.createdAt.toISOString().slice(0, 10),
          appointments: p._count.appointments,
        })),
        summary: [
          { label: "New patients", value: totalPatients },
          ...Object.entries(genderCounts).map(([g, c]) => ({ label: genderLabel(g), value: c })),
        ],
      };
    }

    case "revenue": {
      const [invoices, paymentMethods, invoiceAgg, paymentAgg, invoiceCount, paymentCount] = await Promise.all([
        db.invoice.findMany({
          where: { createdAt: dateFilter },
          include: { patient: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        db.payment.groupBy({
          by: ["method"],
          where: { paidAt: dateFilter, amount: { gt: 0 } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        db.invoice.aggregate({
          where: { createdAt: dateFilter },
          _sum: { total: true, paid: true },
        }),
        db.payment.aggregate({
          where: { paidAt: dateFilter, amount: { gt: 0 } },
          _sum: { amount: true },
        }),
        db.invoice.count({ where: { createdAt: dateFilter } }),
        db.payment.count({ where: { paidAt: dateFilter, amount: { gt: 0 } } }),
      ]);
      const billed = invoiceAgg._sum.total ?? 0;
      const collected = paymentAgg._sum.amount ?? 0;
      const unpaidAgg = await db.invoice.aggregate({
        where: { createdAt: dateFilter, status: { not: "CANCELLED" } },
        _sum: { total: true, paid: true },
      });
      const outstanding = Math.max(0, (unpaidAgg._sum.total ?? 0) - (unpaidAgg._sum.paid ?? 0));
      return {
        ...base,
        title: "Revenue report",
        columns: [
          { key: "invoiceNo", label: "Invoice" },
          { key: "patient", label: "Patient" },
          { key: "date", label: "Date" },
          { key: "subtotal", label: "Subtotal", align: "right" },
          { key: "total", label: "Total", align: "right" },
          { key: "paid", label: "Paid", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows: invoices.map((i) => ({
          invoiceNo: i.invoiceNo,
          patient: `${i.patient.firstName} ${i.patient.lastName}`,
          date: i.createdAt.toISOString().slice(0, 10),
          subtotal: fmt(i.subtotal),
          total: fmt(i.total),
          paid: fmt(i.paid),
          status: i.status,
        })),
        summary: [
          { label: "Billed", value: fmt(billed) },
          { label: "Collected", value: fmt(collected) },
          { label: "Outstanding", value: fmt(outstanding) },
          { label: "Invoices", value: invoiceCount },
          { label: "Payments", value: paymentCount },
        ],
        ...(paymentMethods.length
          ? { paymentMethods: paymentMethods.map((m) => ({ method: m.method, amount: fmt(m._sum.amount ?? 0), count: m._count._all })) }
          : {}),
      };
    }

    case "doctors": {
      const [doctors, doctorCount] = await Promise.all([
        db.doctor.findMany({
          include: { user: { select: { firstName: true, lastName: true, title: true } }, department: { select: { name: true } } },
        }),
        db.doctor.count(),
      ]);
      const ids = doctors.map((d) => d.id);
      const [apptGroups, consGroups, invoiceGroups] = await Promise.all([
        db.appointment.groupBy({ by: ["doctorId"], where: { doctorId: { in: ids }, date: dateFilter }, _count: { _all: true } }),
        db.consultation.groupBy({ by: ["doctorId"], where: { doctorId: { in: ids }, createdAt: dateFilter }, _count: { _all: true } }),
        db.invoice.groupBy({
          by: ["appointmentId"],
          where: { appointmentId: { not: null }, appointment: { doctorId: { in: ids } }, createdAt: dateFilter },
          _sum: { total: true },
        }),
      ]);
      const apptMap = new Map(apptGroups.map((g) => [g.doctorId, g._count._all]));
      const consMap = new Map(consGroups.map((g) => [g.doctorId, g._count._all]));
      const apptDoctor = new Map<string, string>();
      if (invoiceGroups.length) {
        const apptIds = invoiceGroups.map((g) => g.appointmentId).filter((id): id is string => id !== null);
        const appts = await db.appointment.findMany({
          where: { id: { in: apptIds } },
          select: { id: true, doctorId: true },
        });
        for (const a of appts) if (a.doctorId) apptDoctor.set(a.id, a.doctorId);
      }
      const revenueByDoctor = new Map<string, number>();
      for (const g of invoiceGroups) {
        const docId = apptDoctor.get(g.appointmentId as string);
        if (!docId) continue;
        revenueByDoctor.set(docId, (revenueByDoctor.get(docId) ?? 0) + (g._sum.total ?? 0));
      }
      return {
        ...base,
        title: "Doctor performance report",
        columns: [
          { key: "doctor", label: "Doctor" },
          { key: "department", label: "Department" },
          { key: "appointments", label: "Appointments", align: "right" },
          { key: "consultations", label: "Consultations", align: "right" },
          { key: "revenue", label: "Revenue", align: "right" },
        ],
        rows: doctors.map((d) => ({
          doctor: `${d.user.title ? d.user.title + " " : ""}${d.user.firstName} ${d.user.lastName}`,
          department: d.department?.name ?? "—",
          appointments: apptMap.get(d.id) ?? 0,
          consultations: consMap.get(d.id) ?? 0,
          revenue: fmt(revenueByDoctor.get(d.id) ?? 0),
        })),
        summary: [
          { label: "Doctors", value: doctorCount },
          { label: "Appointments", value: [...apptMap.values()].reduce((a, b) => a + b, 0) },
          { label: "Consultations", value: [...consMap.values()].reduce((a, b) => a + b, 0) },
          { label: "Billed revenue", value: fmt([...revenueByDoctor.values()].reduce((a, b) => a + b, 0)) },
        ],
      };
    }

    case "appointments": {
      const [items, totalCount, statusGroups, typeGroups] = await Promise.all([
        db.appointment.findMany({
          where: { date: dateFilter },
          include: {
            patient: { select: { firstName: true, lastName: true, patientNo: true } },
            doctor: { include: { user: { select: { firstName: true, lastName: true, title: true } } } },
            department: { select: { name: true } },
          },
          orderBy: { date: "desc" },
          take: 500,
        }),
        db.appointment.count({ where: { date: dateFilter } }),
        db.appointment.groupBy({ by: ["status"], where: { date: dateFilter }, _count: { _all: true } }),
        db.appointment.groupBy({ by: ["type"], where: { date: dateFilter }, _count: { _all: true } }),
      ]);
      return {
        ...base,
        title: "Appointment report",
        columns: [
          { key: "tokenNo", label: "Token" },
          { key: "patient", label: "Patient" },
          { key: "doctor", label: "Doctor" },
          { key: "department", label: "Department" },
          { key: "date", label: "Date" },
          { key: "time", label: "Time" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
        ],
        rows: items.map((a) => ({
          tokenNo: a.tokenNo,
          patient: `${a.patient.firstName} ${a.patient.lastName}`,
          doctor: a.doctor ? `${a.doctor.user.title ? a.doctor.user.title + " " : ""}${a.doctor.user.firstName} ${a.doctor.user.lastName}` : "—",
          department: a.department?.name ?? "—",
          date: a.date.toISOString().slice(0, 10),
          time: a.startTime,
          type: a.type,
          status: a.status,
        })),
        summary: [
          { label: "Total", value: totalCount },
          ...statusGroups.map((g) => ({ label: g.status, value: g._count._all })),
          ...typeGroups.map((g) => ({ label: g.type, value: g._count._all })),
        ],
      };
    }

    case "medicines": {
      const [saleItems, saleCount, medicines] = await Promise.all([
        db.medicineSale.findMany({
          where: { createdAt: dateFilter },
          select: { items: true },
        }),
        db.medicineSale.count({ where: { createdAt: dateFilter } }),
        db.medicine.findMany({ take: 300 }),
      ]);
      const usage = new Map<string, { qty: number; revenue: number }>();
      for (const sale of saleItems) {
        let items: { medicineId?: string; name?: string; quantity?: number; unitPrice?: number }[] = [];
        try {
          items = JSON.parse(sale.items);
        } catch {}
        for (const it of items) {
          const id = it.medicineId ?? it.name ?? "other";
          const qty = Number(it.quantity ?? 1);
          const revenue = qty * Number(it.unitPrice ?? 0);
          const cur = usage.get(id) ?? { qty: 0, revenue: 0 };
          usage.set(id, { qty: cur.qty + qty, revenue: cur.revenue + revenue });
        }
      }
      const rows = medicines
        .map((m) => {
          const u = usage.get(m.id) ?? { qty: 0, revenue: 0 };
          return {
            medicine: m.name,
            category: m.category,
            stock: m.stock,
            soldQty: u.qty,
            revenue: fmt(u.revenue),
            status: m.stock <= m.reorderLevel ? "LOW STOCK" : "OK",
          };
        })
        .sort((a, b) => Number(b.soldQty) - Number(a.soldQty))
        .slice(0, 50);
      const totalSold = [...usage.values()].reduce((s, u) => s + u.qty, 0);
      const lowStockCount = medicines.filter((m) => m.stock <= m.reorderLevel).length;
      const salesTotal = [...usage.values()].reduce((s, u) => s + u.revenue, 0);
      return {
        ...base,
        title: "Medicine report",
        columns: [
          { key: "medicine", label: "Medicine" },
          { key: "category", label: "Category" },
          { key: "stock", label: "Stock", align: "right" },
          { key: "soldQty", label: "Units sold", align: "right" },
          { key: "revenue", label: "Sales", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows,
        summary: [
          { label: "Units dispensed", value: totalSold },
          { label: "Sales value", value: fmt(salesTotal) },
          { label: "Low stock items", value: lowStockCount },
          { label: "Sale transactions", value: saleCount },
        ],
      };
    }

    case "inventory": {
      const [equipment, statusGroups, categoryGroups] = await Promise.all([
        db.medicalEquipment.findMany({ orderBy: { code: "asc" }, take: 300 }),
        db.medicalEquipment.groupBy({ by: ["status"], _count: { _all: true } }),
        db.medicalEquipment.groupBy({ by: ["category"], _count: { _all: true } }),
      ]);
      const daysUntil = (d: Date | null) =>
        d ? Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000)) : null;
      return {
        ...base,
        title: "Inventory report",
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: "Equipment" },
          { key: "category", label: "Category" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status" },
          { key: "warranty", label: "Warranty (days)", align: "right" },
          { key: "maintenance", label: "Maintenance (days)", align: "right" },
          { key: "cost", label: "Cost", align: "right" },
        ],
        rows: equipment.map((e) => ({
          code: e.code,
          name: e.name,
          category: e.category,
          location: e.location ?? "—",
          status: e.status,
          warranty: daysUntil(e.warrantyExpiry),
          maintenance: daysUntil(e.nextMaintenance),
          cost: fmt(e.purchaseCost),
        })),
        summary: [
          { label: "Items", value: equipment.length },
          ...statusGroups.map((g) => ({ label: g.status, value: g._count._all })),
          ...categoryGroups.map((g) => ({ label: g.category, value: g._count._all })),
        ],
      };
    }

    case "admissions": {
      const [items, totalCount, statusGroups, beds, dischargeRows] = await Promise.all([
        db.admission.findMany({
          where: { admittedAt: dateFilter },
          include: { patient: { select: { firstName: true, lastName: true, patientNo: true } }, doctor: { include: { user: { select: { firstName: true, lastName: true, title: true } } } } },
          orderBy: { admittedAt: "desc" },
          take: 500,
        }),
        db.admission.count({ where: { admittedAt: dateFilter } }),
        db.admission.groupBy({ by: ["status"], where: { admittedAt: dateFilter }, _count: { _all: true } }),
        db.bed.groupBy({ by: ["status"], _count: { _all: true } }),
        db.admission.findMany({
          where: { admittedAt: dateFilter, dischargeAt: { not: null } },
          select: { admittedAt: true, dischargeAt: true },
        }),
      ]);
      const avgStayDays =
        dischargeRows.length > 0
          ? dischargeRows.reduce((s, a) => s + (a.dischargeAt!.getTime() - a.admittedAt.getTime()) / 86_400_000, 0) / dischargeRows.length
          : 0;
      return {
        ...base,
        title: "Admission report",
        columns: [
          { key: "admissionNo", label: "No." },
          { key: "patient", label: "Patient" },
          { key: "doctor", label: "Doctor" },
          { key: "admitted", label: "Admitted" },
          { key: "discharged", label: "Discharged" },
          { key: "status", label: "Status" },
        ],
        rows: items.map((a) => ({
          admissionNo: a.admissionNo,
          patient: `${a.patient.firstName} ${a.patient.lastName}`,
          doctor: a.doctor ? `${a.doctor.user.title ? a.doctor.user.title + " " : ""}${a.doctor.user.firstName} ${a.doctor.user.lastName}` : "—",
          admitted: a.admittedAt.toISOString().slice(0, 10),
          discharged: a.dischargeAt ? a.dischargeAt.toISOString().slice(0, 10) : "—",
          status: a.status,
        })),
        summary: [
          { label: "Admissions", value: totalCount },
          { label: "Avg stay", value: `${avgStayDays.toFixed(1)} days` },
          ...statusGroups.map((g) => ({ label: g.status, value: g._count._all })),
          { label: "Occupied beds", value: beds.find((b) => b.status === "OCCUPIED")?._count._all ?? 0 },
          { label: "Available beds", value: beds.find((b) => b.status === "AVAILABLE")?._count._all ?? 0 },
        ],
      };
    }

    default:
      throw new ApiError(400, "Unknown report type");
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export async function exportReportPdf(result: ReportResult): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const gray = rgb(0.42, 0.45, 0.5);
  const blue = rgb(0.15, 0.39, 0.92);
  const dark = rgb(0.1, 0.11, 0.13);

  const hospital = await db.hospital.findFirst();
  const margin = 40;
  const pageWidth = 595;
  const contentWidth = pageWidth - margin * 2;
  const colWidth = contentWidth / result.columns.length;

  let y = 800;
  page.drawText((hospital?.name ?? "City Care Hospital").toUpperCase(), { x: margin, y, size: 16, font: bold, color: blue });
  y -= 22;
  page.drawText(`${result.title} — ${result.from ?? "beginning"} to ${result.to ?? "today"}`, { x: margin, y, size: 11, font: font, color: gray });
  y -= 26;

  // Summary line
  const summaryText = result.summary.map((s) => `${s.label}: ${s.value}`).join("   ");
  page.drawText(summaryText, { x: margin, y, size: 9, font: font, color: dark });
  y -= 16;
  page.drawRectangle({ x: margin, y, width: contentWidth, height: 1, color: rgb(0.88, 0.9, 0.93) });
  y -= 18;

  const drawRow = (cells: string[], isHeader: boolean) => {
    if (y < 50) {
      const next = doc.addPage([595, 842]);
      y = 800;
      void next;
    }
    cells.forEach((cell, i) => {
      const align = result.columns[i]?.align === "right" ? "right" : "left";
      const x = align === "right" ? margin + (i + 1) * colWidth - 4 : margin + i * colWidth + 4;
      page.drawText(cell, {
        x,
        y,
        size: isHeader ? 9 : 8,
        font: isHeader ? bold : font,
        color: isHeader ? gray : dark,
        maxWidth: colWidth - 8,
      });
    });
    y -= isHeader ? 22 : 16;
  };

  drawRow(result.columns.map((c) => c.label), true);
  for (const row of result.rows) {
    drawRow(result.columns.map((c) => String(row[c.key] ?? "—")), false);
  }

  return doc.save();
}

export async function exportReportExcel(result: ReportResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hospital Management System";
  const sheet = workbook.addWorksheet(result.title.replace(/\s+/g, "-").slice(0, 31));

  sheet.columns = result.columns.map((c) => ({ header: c.label, key: c.key, width: 24 }));
  for (const row of result.rows) {
    sheet.addRow(Object.fromEntries(result.columns.map((c) => [c.key, row[c.key] ?? ""])));
  }

  // Summary block below the table.
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };

  const start = sheet.rowCount + 2;
  result.summary.forEach((s, i) => {
    const row = sheet.getRow(start + i);
    row.getCell(1).value = s.label;
    row.getCell(2).value = s.value;
    row.font = { bold: i === 0 };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
