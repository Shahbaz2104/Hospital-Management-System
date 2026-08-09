import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { db } from "@/lib/db";

/**
 * Generates a payment receipt PDF (A4) for a completed payment.
 */
export async function buildReceiptPdf(paymentId: string): Promise<Uint8Array> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: {
        include: {
          patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, phone: true, email: true } },
          issuedBy: { select: { firstName: true, lastName: true } },
        },
      },
      receivedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.amount <= 0) throw new Error("Refunds do not have receipts");

  const hospital = payment.hospitalId
    ? await db.hospital.findUnique({ where: { id: payment.hospitalId } })
    : null;
  const invoice = payment.invoice;
  const patient = invoice.patient;
  const amount = Math.abs(payment.amount);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  const margin = 50;

  const header = (text: string, size: number, f = bold, color = rgb(0.15, 0.35, 0.75), x = margin, y = 0) => {
    page.drawText(text, { x, y, size, font: f, color });
  };

  let y = 770;
  header(hospital?.name ?? "City Care Hospital", 20);
  header([hospital?.address, hospital?.phone, hospital?.email].filter(Boolean).join("  ·  "), 9, font, rgb(0.35, 0.35, 0.35), margin, y - 16);

  y -= 48;
  header("PAYMENT RECEIPT", 14, bold, rgb(0.1, 0.1, 0.1));
  header(`Receipt No: ${payment.paymentNo}`, 9, font, rgb(0.35, 0.35, 0.35), margin, y - 16);
  header(`Invoice: ${invoice.invoiceNo}`, 9, font, rgb(0.35, 0.35, 0.35), width - margin - 130, y - 16);
  header(`Paid: ${payment.paidAt.toLocaleDateString("en-GB")}`, 9, font, rgb(0.35, 0.35, 0.35), width - margin - 130, y - 28);

  y -= 56;
  page.drawRectangle({ x: margin, y: y - 14, width: width - margin * 2, height: 1, color: rgb(0.85, 0.85, 0.85) });
  header("Patient", 9, bold, rgb(0.3, 0.3, 0.3));
  header(`${patient.firstName} ${patient.lastName}`, 11, bold);
  header(`Patient No: ${patient.patientNo}`, 9, font, rgb(0.35, 0.35, 0.35), margin, y - 14);
  header(patient.phone ?? "", 9, font, rgb(0.35, 0.35, 0.35), margin, y - 26);
  header(patient.email ?? "", 9, font, rgb(0.35, 0.35, 0.35), margin, y - 38);

  y -= 70;
  header("Payment details", 9, bold, rgb(0.3, 0.3, 0.3));
  header("Amount paid", 10, font, rgb(0.35, 0.35, 0.35));
  header(`$${amount.toFixed(2)}`, 10, bold, rgb(0.15, 0.5, 0.25), width - margin - 100);
  y -= 16;
  header("Method", 10, font, rgb(0.35, 0.35, 0.35));
  header(payment.method, 10, bold, undefined, width - margin - 100);
  y -= 16;
  header("Status", 10, font, rgb(0.35, 0.35, 0.35));
  header(payment.status, 10, bold, undefined, width - margin - 100);
  y -= 16;
  header("Received by", 10, font, rgb(0.35, 0.35, 0.35));
  header(
    payment.receivedBy ? `${payment.receivedBy.firstName} ${payment.receivedBy.lastName}` : "Online",
    10,
    bold,
    undefined,
    width - margin - 100
  );
  if (payment.reference) {
    y -= 16;
    header("Reference", 10, font, rgb(0.35, 0.35, 0.35));
    header(payment.reference, 9, font, undefined, width - margin - 100);
  }

  y -= 48;
  page.drawRectangle({ x: margin, y: y - 10, width: width - margin * 2, height: 1, color: rgb(0.85, 0.85, 0.85) });
  header(
    `Invoice subtotal: $${invoice.subtotal.toFixed(2)}  ·  Tax: ${invoice.taxRate}%  ·  Total: $${invoice.total.toFixed(2)}`,
    9,
    font,
    rgb(0.35, 0.35, 0.35)
  );
  y -= 28;
  header(`Amount outstanding: $${Math.max(0, invoice.total - invoice.paid).toFixed(2)}`, 10, bold, rgb(0.55, 0.3, 0.2));
  y -= 44;
  header("Thank you for choosing " + (hospital?.name ?? "our hospital") + ".", 9, font, rgb(0.45, 0.45, 0.45));

  return doc.save();
}
