import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { notify } from "@/services/notifications";
import type { PrescriptionCreateInput } from "@/validators/prescriptions";

async function nextPrescriptionNo(): Promise<string> {
  const last = await db.prescription.findFirst({
    orderBy: { prescriptionNo: "desc" },
    select: { prescriptionNo: true },
  });
  const n = last ? parseInt(String(last.prescriptionNo).replace(/\D+/g, ""), 10) || 0 : 0;
  return `RX-${String(n + 1).padStart(4, "0")}`;
}

const detailInclude = {
  patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, dob: true, gender: true, phone: true } },
  doctor: {
    include: {
      user: { select: { title: true, firstName: true, lastName: true, email: true } },
      department: { select: { name: true } },
    },
  },
  consultation: { select: { consultationNo: true, diagnosis: true } },
};

export async function listPrescriptions(opts: { patientId?: string; status?: string; search?: string }) {
  const where: Record<string, unknown> = {};
  if (opts.patientId) where.patientId = opts.patientId;
  if (opts.status) where.status = opts.status;
  if (opts.search) {
    where.OR = [
      { prescriptionNo: { contains: opts.search } },
      { diagnosis: { contains: opts.search } },
      { patient: { firstName: { contains: opts.search } } },
      { patient: { lastName: { contains: opts.search } } },
      { patient: { patientNo: { contains: opts.search } } },
    ];
  }
  const [items, total] = await Promise.all([
    db.prescription.findMany({
      where,
      include: detailInclude,
      orderBy: { issuedAt: "desc" },
      take: 100,
    }),
    db.prescription.count({ where }),
  ]);
  return { items, total };
}

export async function createPrescription(actor: { id: string }, input: PrescriptionCreateInput) {
  const prescriptionNo = await nextPrescriptionNo();
  const items = input.items.map((item) => ({
    medicine: item.medicine,
    medicineId: item.medicineId ?? null,
    dose: item.dose ?? null,
    frequency: item.frequency ?? null,
    duration: item.duration ?? null,
    instructions: item.instructions ?? null,
  }));
  const prescription = await db.prescription.create({
    data: {
      prescriptionNo,
      patientId: input.patientId,
      doctorId: input.doctorId || null,
      consultationId: input.consultationId || null,
      appointmentId: input.appointmentId || null,
      diagnosis: input.diagnosis || null,
      notes: input.notes || null,
      items: JSON.stringify(items),
    },
    include: detailInclude,
  });
  await logAudit({ userId: actor.id, action: "PRESCRIPTION_CREATED", entity: "Prescription", entityId: prescription.id, meta: { prescriptionNo } });
  return prescription;
}

export async function updatePrescriptionStatus(
  actor: { id: string },
  id: string,
  status: "ACTIVE" | "COMPLETED" | "CANCELLED"
) {
  const existing = await db.prescription.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Prescription not found");
  const updated = await db.prescription.update({ where: { id }, data: { status }, include: detailInclude });
  await logAudit({ userId: actor.id, action: "PRESCRIPTION_STATUS", entity: "Prescription", entityId: id, meta: { status } });
  return updated;
}

export function parseItems(items: string): Array<{
  medicine: string;
  medicineId?: string | null;
  dose?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
}> {
  try {
    return JSON.parse(items ?? "[]");
  } catch {
    return [];
  }
}

export async function getPrescriptionForPdf(id: string) {
  const prescription = await db.prescription.findUnique({
    where: { id },
    include: {
      ...detailInclude,
      hospital: { select: { name: true, address: true, phone: true, email: true, logoUrl: true } },
    },
  });
  if (!prescription) throw new ApiError(404, "Prescription not found");
  return prescription;
}

export async function renderPrescriptionPdf(
  prescription: Awaited<ReturnType<typeof getPrescriptionForPdf>>
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595.28, 841.89]); // A4 portrait
  const { width } = page.getSize();
  const margin = 48;
  let y = 770;

  const hospital = prescription.hospital;
  page.drawText(hospital?.name ?? "Hospital", { x: margin, y: y, size: 18, font: bold, color: rgb(0.15, 0.35, 0.75) });
  y -= 16;
  page.drawText([hospital?.address, hospital?.phone, hospital?.email].filter(Boolean).join("  ·  "), {
    x: margin,
    y: y,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 12;
  page.drawText(`PRESCRIPTION ${prescription.prescriptionNo}`, { x: margin, y: y, size: 11, font: bold });
  page.drawText(`Issued: ${prescription.issuedAt.toLocaleDateString("en-GB")}`, { x: width - margin - 120, y: y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });

  y -= 30;
  page.drawText(
    `Patient: ${prescription.patient.firstName} ${prescription.patient.lastName} (${prescription.patient.patientNo})`,
    { x: margin, y: y, size: 11, font: bold }
  );
  y -= 16;
  page.drawText(
    `Dr. ${prescription.doctor?.user.title ? `${prescription.doctor.user.title} ` : ""}${prescription.doctor?.user.firstName ?? ""} ${prescription.doctor?.user.lastName ?? ""}`,
    { x: margin, y: y, size: 11, font }
  );
  y -= 14;
  if (prescription.consultation?.diagnosis) {
    page.drawText(`Diagnosis: ${prescription.consultation.diagnosis}`, { x: margin, y: y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 16;
  }

  y -= 8;
  page.drawRectangle({
    x: margin,
    y: y - 2,
    width: width - margin * 2,
    height: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 26;

  const items = parseItems(prescription.items);
  const rows: string[][] = [["#", "Medicine", "Dose", "Frequency", "Duration", "Instructions"]];
  items.forEach((item, i) => {
    rows.push([
      String(i + 1),
      item.medicine,
      item.dose ?? "",
      item.frequency ?? "",
      item.duration ?? "",
      item.instructions ?? "",
    ]);
  });

  const colWidths = [28, 150, 80, 90, 70, 130];
  const rowHeight = 22;

  for (const row of rows) {
    if (y < 60) {
      page = doc.addPage([595.28, 841.89]);
      y = 800;
    }
    let x = margin;
    const isHeader = row === rows[0];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const wrapped = cell.length > 28 ? `${cell.slice(0, 28)}…` : cell;
      page.drawText(wrapped, {
        x: x + 4,
        y: y - 14,
        size: isHeader ? 10 : 9.5,
        font: isHeader ? bold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
      x += colWidths[c];
    }
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: width - margin * 2,
      height: 1,
      color: rgb(0.9, 0.9, 0.9),
    });
    y -= rowHeight;
  }

  y -= 8;
  if (prescription.notes) {
    page.drawText(`Notes: ${prescription.notes}`, { x: margin, y: y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 24;
  }

  // QR verification code.
  const qrPayload = JSON.stringify({
    v: 1,
    rx: prescription.prescriptionNo,
    id: prescription.id,
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 160, errorCorrectionLevel: "M" });
  const qrImage = await doc.embedPng(qrDataUrl.replace(/^data:image\/png;base64,/, ""));
  if (y > 130) {
    page.drawImage(qrImage, { x: width - margin - 70, y: y - 70, width: 70, height: 70 });
    page.drawText(`Scan to verify`, { x: width - margin - 80, y: y - 82, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  }

  page.drawText(
    `This prescription was issued electronically and verified by QR.  ·  ${prescription.prescriptionNo}`,
    { x: margin, y: 40, size: 8, font, color: rgb(0.45, 0.45, 0.45) }
  );

  return doc.save();
}

export async function verifyPrescriptionQr(payload: string) {
  let parsed: { v?: number; rx?: string; id?: string };
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new ApiError(400, "Invalid QR payload");
  }
  if (!parsed?.rx || !parsed.id) throw new ApiError(400, "Invalid QR payload");
  const prescription = await db.prescription.findUnique({
    where: { id: parsed.id },
    include: {
      patient: { select: { firstName: true, lastName: true, patientNo: true } },
      doctor: { include: { user: { select: { title: true, firstName: true, lastName: true } } } },
      hospital: { select: { name: true } },
    },
  });
  if (!prescription || prescription.prescriptionNo !== parsed.rx) {
    throw new ApiError(404, "Prescription not found");
  }
  return {
    valid: true,
    prescriptionNo: prescription.prescriptionNo,
    patient: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
    patientNo: prescription.patient.patientNo,
    doctor: `${prescription.doctor?.user.title ? `${prescription.doctor.user.title} ` : ""}${prescription.doctor?.user.firstName ?? ""} ${prescription.doctor?.user.lastName ?? ""}`,
    hospital: prescription.hospital?.name,
    issuedAt: prescription.issuedAt,
    status: prescription.status,
  };
}

export async function notifyPharmacyOfPrescription(prescription: { id: string; prescriptionNo: string }) {
  await notify({
    roles: ["PHARMACIST"],
    title: `New prescription: ${prescription.prescriptionNo}`,
    message: "A prescription is ready for dispensing.",
    type: "BILLING",
    entity: "Prescription",
    entityId: prescription.id,
  });
}
