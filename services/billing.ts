import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { z } from "zod";
import { logAudit } from "@/services/audit";
import type {
  createClaimSchema,
  createInvoiceSchema,
  insuranceCompanySchema,
  insurancePolicySchema,
  recordPaymentSchema,
  refundSchema,
} from "@/validators/billing";

type Actor = { userId: string; hospitalId?: string | null };

const EPSILON = 0.009;

async function nextNumber(kind: "invoice" | "payment" | "claim" | "policy" | "company"): Promise<string> {
  let last: string | null = null;
  if (kind === "invoice") {
    last = (await db.invoice.findFirst({ orderBy: { invoiceNo: "desc" }, select: { invoiceNo: true } }))?.invoiceNo ?? null;
  } else if (kind === "payment") {
    last = (await db.payment.findFirst({ orderBy: { paymentNo: "desc" }, select: { paymentNo: true } }))?.paymentNo ?? null;
  } else if (kind === "claim") {
    last = (await db.insuranceClaim.findFirst({ orderBy: { claimNo: "desc" }, select: { claimNo: true } }))?.claimNo ?? null;
  } else if (kind === "policy") {
    last = (await db.insurancePolicy.findFirst({ orderBy: { policyNumber: "desc" }, select: { policyNumber: true } }))?.policyNumber ?? null;
  } else {
    last = (await db.insuranceCompany.findFirst({ orderBy: { code: "desc" }, select: { code: true } }))?.code ?? null;
  }
  const n = last ? parseInt(String(last).replace(/\D+/g, ""), 10) || 0 : 0;
  const prefix = kind === "invoice" ? "INV" : kind === "payment" ? "PAY" : kind === "claim" ? "CLM" : kind === "policy" ? "POL" : "IC";
  return `${prefix}-${String(n + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Shared totals + status
// ---------------------------------------------------------------------------

export function computeInvoiceTotals(opts: {
  subtotal: number;
  discountType: "FIXED" | "PERCENT";
  discount: number;
  taxRate: number;
  insuranceCoverage: number;
}) {
  const { subtotal, discountType, discount, taxRate, insuranceCoverage } = opts;
  let discountAmount = 0;
  if (discountType === "PERCENT") {
    discountAmount = subtotal * (Math.min(discount, 100) / 100);
  } else {
    discountAmount = Math.min(discount, subtotal);
  }
  const taxable = subtotal - discountAmount;
  const taxAmount = taxable * (taxRate / 100);
  const total = Math.max(0, Math.round((taxable + taxAmount - insuranceCoverage) * 100) / 100);
  return { discountAmount, taxAmount, total };
}

export function invoiceStatus(paid: number, total: number) {
  if (paid >= total - EPSILON) return "PAID";
  if (paid > EPSILON) return "PARTIAL";
  return "PENDING";
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

const invoiceInclude = {
  patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, phone: true, insuranceProvider: true } },
  items: { select: { id: true, type: true, description: true, quantity: true, unitPrice: true, amount: true, refType: true, refId: true }, orderBy: { createdAt: "asc" as const } },
  payments: {
    include: { receivedBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { paidAt: "desc" as const },
  },
  claim: {
    include: {
      policy: {
        select: { id: true, policyNumber: true, coveragePercent: true, company: { select: { id: true, name: true } } },
      },
    },
  },
  insurancePolicy: {
    select: { id: true, policyNumber: true, coveragePercent: true, company: { select: { id: true, name: true } } },
  },
  issuedBy: { select: { id: true, firstName: true, lastName: true } },
};

export async function listInvoices(filters: { status?: string; search?: string; page?: number; pageSize?: number } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { invoiceNo: { contains: filters.search, mode: "insensitive" } },
      { patient: { firstName: { contains: filters.search, mode: "insensitive" } } },
      { patient: { lastName: { contains: filters.search, mode: "insensitive" } } },
      { patient: { patientNo: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

  const [items, total] = await Promise.all([
    db.invoice.findMany({
      where,
      include: { patient: invoiceInclude.patient, items: true, payments: { select: { amount: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.invoice.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getInvoice(id: string) {
  const invoice = await db.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  return invoice;
}

export async function createInvoice(actor: Actor, input: z.infer<typeof createInvoiceSchema>) {
  const patient = await db.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) throw new ApiError(404, "Patient not found");

  let insurancePolicyId: string | null = null;
  let insuranceCoverage = 0;
  if (input.insurancePolicyId) {
    const policy = await db.insurancePolicy.findUnique({
      where: { id: input.insurancePolicyId },
      include: { company: { select: { coveragePercent: true } } },
    });
    if (!policy || policy.patientId !== patient.id) {
      throw new ApiError(400, "Insurance policy not found for this patient");
    }
    if (policy.status !== "ACTIVE") {
      throw new ApiError(400, "Insurance policy is not active");
    }
    insurancePolicyId = policy.id;
  }

  const items = input.items.map((i) => ({
    type: i.type,
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    amount: Math.round(i.quantity * i.unitPrice * 100) / 100,
  }));
  const subtotal = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;

  const discountAmount = input.discountType === "PERCENT"
    ? subtotal * (Math.min(input.discount, 100) / 100)
    : Math.min(input.discount, subtotal);

  if (insurancePolicyId) {
    const policy = await db.insurancePolicy.findUnique({
      where: { id: insurancePolicyId },
      select: { coveragePercent: true },
    });
    insuranceCoverage = Math.round((subtotal - discountAmount) * (policy?.coveragePercent ?? 0) / 100 * 100) / 100;
  }

  const totals = computeInvoiceTotals({
    subtotal,
    discountType: input.discountType,
    discount: input.discount,
    taxRate: input.taxRate,
    insuranceCoverage,
  });

  const invoiceNo = await nextNumber("invoice");
  const invoice = await db.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        invoiceNo,
        patientId: input.patientId,
        admissionId: input.admissionId ?? null,
        appointmentId: input.appointmentId ?? null,
        consultationId: input.consultationId ?? null,
        insurancePolicyId,
        subtotal,
        discount: totals.discountAmount,
        discountType: input.discountType,
        taxRate: input.taxRate,
        taxAmount: totals.taxAmount,
        insuranceCoverage,
        total: totals.total,
        paid: 0,
        status: "PENDING",
        notes: input.notes ?? null,
        issuedById: actor.userId,
        hospitalId: actor.hospitalId ?? null,
        items: { create: items },
      },
      include: { items: true },
    });
    return created;
  });

  await logAudit({
    userId: actor.userId,
    action: "INVOICE_CREATED",
    entity: "Invoice",
    entityId: invoice.id,
    meta: { invoiceNo, patient: patient.patientNo, subtotal, total: totals.total, items: items.length },
  });
  return invoice;
}

export async function cancelInvoice(actor: Actor, id: string) {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.status === "CANCELLED") throw new ApiError(409, "Invoice already cancelled");
  if (invoice.paid > EPSILON) throw new ApiError(409, "Cannot cancel an invoice with recorded payments");
  const updated = await db.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
  await logAudit({
    userId: actor.userId,
    action: "INVOICE_CANCELLED",
    entity: "Invoice",
    entityId: id,
    meta: { invoiceNo: invoice.invoiceNo },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Payments & refunds
// ---------------------------------------------------------------------------

export async function listPayments(filters: { method?: string; status?: string; search?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.method && filters.method !== "ALL") where.method = filters.method;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.search) {
    where.invoice = { patient: { OR: [{ firstName: { contains: filters.search, mode: "insensitive" } }, { lastName: { contains: filters.search, mode: "insensitive" } }, { patientNo: { contains: filters.search, mode: "insensitive" } }] } };
  }

  const items = await db.payment.findMany({
    where,
    include: {
      invoice: { include: { patient: { select: { id: true, patientNo: true, firstName: true, lastName: true } } } },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 200,
  });
  return items;
}

export async function recordPayment(actor: Actor, input: z.infer<typeof recordPaymentSchema>) {
  // Early 404 so callers get a clear error without a transaction.
  const invoice = await db.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new ApiError(404, "Invoice not found");

  const paymentNo = await nextNumber("payment");
  const payment = await db.$transaction(async (tx) => {
    // Re-read inside the transaction: invoice.paid is read-modify-written
    // here, so a stale copy from outside would cause lost updates.
    const fresh = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
    if (!fresh) throw new ApiError(404, "Invoice not found");
    if (fresh.status === "CANCELLED") throw new ApiError(409, "Cannot record a payment on a cancelled invoice");

    const remaining = Math.round((fresh.total - fresh.paid) * 100) / 100;
    if (input.amount > remaining + EPSILON) {
      throw new ApiError(400, `Amount exceeds the outstanding balance of ${remaining.toFixed(2)}`);
    }

    const created = await tx.payment.create({
      data: {
        paymentNo,
        invoiceId: fresh.id,
        amount: input.amount,
        method: input.method,
        reference: input.reference ?? null,
        status: "COMPLETED",
        notes: input.notes ?? null,
        receivedById: actor.userId,
        hospitalId: actor.hospitalId ?? null,
      },
    });
    const paid = Math.round((fresh.paid + input.amount) * 100) / 100;
    await tx.invoice.update({
      where: { id: fresh.id },
      data: { paid, status: invoiceStatus(paid, fresh.total) },
    });
    return created;
  });

  await logAudit({
    userId: actor.userId,
    action: "PAYMENT_RECORDED",
    entity: "Payment",
    entityId: payment.id,
    meta: { paymentNo, invoiceNo: invoice.invoiceNo, amount: input.amount, method: input.method },
  });
  return payment;
}

export async function refundPayment(actor: Actor, input: z.infer<typeof refundSchema>) {
  // Early checks outside the transaction for fast failures.
  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    include: { invoice: { select: { invoiceNo: true } } },
  });
  if (!payment) throw new ApiError(404, "Payment not found");
  if (payment.amount <= 0) throw new ApiError(409, "This payment is already a refund");
  if (payment.status !== "COMPLETED") throw new ApiError(409, "Only completed payments can be refunded");

  const refundNo = await nextNumber("payment");
  const result = await db.$transaction(async (tx) => {
    const freshPayment = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!freshPayment || freshPayment.amount <= 0 || freshPayment.status !== "COMPLETED") {
      throw new ApiError(409, "Payment is no longer refundable");
    }

    // Cumulative cap: refunds must never exceed the original paid amount,
    // even across multiple partial refunds of the same payment.
    const refundedAgg = await tx.payment.aggregate({
      where: { refundOfId: freshPayment.id },
      _sum: { amount: true },
    });
    const alreadyRefunded = Math.abs(refundedAgg._sum.amount ?? 0);
    const refundable = Math.round((freshPayment.amount - alreadyRefunded) * 100) / 100;
    if (input.amount > refundable + EPSILON) {
      throw new ApiError(400, `Refund cannot exceed the remaining refundable amount of ${refundable.toFixed(2)}`);
    }

    const invoice = await tx.invoice.findUnique({ where: { id: freshPayment.invoiceId } });
    if (!invoice) throw new ApiError(404, "Invoice not found");

    const refund = await tx.payment.create({
      data: {
        paymentNo: refundNo,
        invoiceId: freshPayment.invoiceId,
        amount: -input.amount,
        method: freshPayment.method,
        status: "COMPLETED",
        notes: input.reason,
        refundOfId: freshPayment.id,
        receivedById: actor.userId,
        hospitalId: actor.hospitalId ?? null,
      },
    });
    const fullyRefunded = Math.abs(alreadyRefunded + input.amount - freshPayment.amount) <= EPSILON;
    if (fullyRefunded) {
      await tx.payment.update({ where: { id: freshPayment.id }, data: { status: "REFUNDED" } });
    }
    const paid = Math.round((invoice.paid - input.amount) * 100) / 100;
    const newStatus = paid <= EPSILON ? "REFUNDED" : paid >= invoice.total - EPSILON ? "PAID" : "PARTIAL";
    await tx.invoice.update({ where: { id: invoice.id }, data: { paid, status: newStatus } });
    return refund;
  });

  await logAudit({
    userId: actor.userId,
    action: "PAYMENT_REFUNDED",
    entity: "Payment",
    entityId: payment.id,
    meta: { refundNo, invoiceNo: payment.invoice.invoiceNo, amount: input.amount, reason: input.reason },
  });
  return result;
}

export async function revenueStats() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayPayments, monthPayments, pending] = await Promise.all([
    db.payment.aggregate({
      where: { status: "COMPLETED", amount: { gt: 0 }, paidAt: { gte: startOfDay } },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { status: "COMPLETED", amount: { gt: 0 }, paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    db.invoice.findMany({
      where: { status: { in: ["PENDING", "PARTIAL"] } },
      select: { total: true, paid: true },
    }),
  ]);

  const outstanding = pending.reduce((s, i) => s + (i.total - i.paid), 0);
  return {
    todayRevenue: todayPayments._sum.amount ?? 0,
    monthRevenue: monthPayments._sum.amount ?? 0,
    outstanding,
    pendingBills: pending.length,
  };
}

// ---------------------------------------------------------------------------
// Insurance: companies, policies, claims
// ---------------------------------------------------------------------------

export async function listInsuranceCompanies(activeOnly = false) {
  return db.insuranceCompany.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: "asc" },
  });
}

export async function createInsuranceCompany(actor: Actor, input: z.infer<typeof insuranceCompanySchema>) {
  const code = await nextNumber("company");
  const company = await db.insuranceCompany.create({
    data: { ...input, code, hospitalId: actor.hospitalId ?? null },
  });
  await logAudit({
    userId: actor.userId,
    action: "INSURANCE_COMPANY_CREATED",
    entity: "InsuranceCompany",
    entityId: company.id,
    meta: { name: company.name, code },
  });
  return company;
}

export async function updateInsuranceCompany(actor: Actor, id: string, input: Partial<z.infer<typeof insuranceCompanySchema>>) {
  const existing = await db.insuranceCompany.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Insurance company not found");
  const company = await db.insuranceCompany.update({ where: { id }, data: input });
  await logAudit({
    userId: actor.userId,
    action: "INSURANCE_COMPANY_UPDATED",
    entity: "InsuranceCompany",
    entityId: id,
    meta: { name: company.name },
  });
  return company;
}

export async function listPolicies(filters: { patientId?: string; status?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  return db.insurancePolicy.findMany({
    where,
    include: {
      patient: { select: { id: true, patientNo: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true, coveragePercent: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function createInsurancePolicy(actor: Actor, input: z.infer<typeof insurancePolicySchema>) {
  const patient = await db.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) throw new ApiError(404, "Patient not found");
  const company = await db.insuranceCompany.findUnique({ where: { id: input.companyId } });
  if (!company) throw new ApiError(404, "Insurance company not found");
  if (!company.active) throw new ApiError(400, "Insurance company is inactive");

  const exists = await db.insurancePolicy.findFirst({ where: { policyNumber: input.policyNumber } });
  if (exists) throw new ApiError(409, "A policy with this number already exists");

  const policyNumber = input.policyNumber ?? (await nextNumber("policy"));
  const policy = await db.insurancePolicy.create({
    data: {
      ...input,
      policyNumber,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  await db.patient.update({
    where: { id: patient.id },
    data: { insuranceProvider: company.name, insuranceNumber: input.policyNumber },
  });

  await logAudit({
    userId: actor.userId,
    action: "INSURANCE_POLICY_CREATED",
    entity: "InsurancePolicy",
    entityId: policy.id,
    meta: { policyNumber, patient: patient.patientNo, company: company.name },
  });
  return policy;
}

export async function listClaims(filters: { status?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  return db.insuranceClaim.findMany({
    where,
    include: {
      invoice: { select: { id: true, invoiceNo: true, total: true, insuranceCoverage: true } },
      policy: {
        include: {
          company: { select: { id: true, name: true } },
          patient: { select: { id: true, patientNo: true, firstName: true, lastName: true } },
        },
      },
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
      decisionBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function createClaim(actor: Actor, input: z.infer<typeof createClaimSchema>) {
  const invoice = await db.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.insuranceCoverage <= 0) {
    throw new ApiError(400, "This invoice has no insurance coverage to claim");
  }
  if (invoice.status === "CANCELLED") throw new ApiError(409, "Cannot claim a cancelled invoice");

  const policy = await db.insurancePolicy.findUnique({ where: { id: input.policyId } });
  if (!policy) throw new ApiError(404, "Policy not found");
  if (policy.patientId !== invoice.patientId) {
    throw new ApiError(400, "Policy does not belong to this invoice's patient");
  }
  if (policy.status !== "ACTIVE") throw new ApiError(400, "Policy is not active");
  if (input.amount > invoice.insuranceCoverage + EPSILON) {
    throw new ApiError(400, `Claim amount exceeds the invoice coverage of ${invoice.insuranceCoverage.toFixed(2)}`);
  }

  const existing = await db.insuranceClaim.findUnique({ where: { invoiceId: invoice.id } });
  if (existing) throw new ApiError(409, "An insurance claim already exists for this invoice");

  const claimNo = await nextNumber("claim");
  const claim = await db.insuranceClaim.create({
    data: {
      claimNo,
      invoiceId: invoice.id,
      policyId: policy.id,
      amount: input.amount,
      status: "SUBMITTED",
      claimRef: input.claimRef ?? null,
      notes: input.notes ?? null,
      submittedById: actor.userId,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  await logAudit({
    userId: actor.userId,
    action: "INSURANCE_CLAIM_SUBMITTED",
    entity: "InsuranceClaim",
    entityId: claim.id,
    meta: { claimNo, invoiceNo: invoice.invoiceNo, amount: input.amount },
  });
  return claim;
}

export async function decideClaim(
  actor: Actor,
  id: string,
  decision: { status: "APPROVED" | "REJECTED"; claimRef?: string; notes?: string }
) {
  const claim = await db.insuranceClaim.findUnique({ where: { id }, include: { invoice: true } });
  if (!claim) throw new ApiError(404, "Claim not found");
  if (claim.status !== "SUBMITTED") {
    throw new ApiError(409, `Only submitted claims can be decided (current: ${claim.status})`);
  }

  let payment: { id: string; paymentNo: string } | null = null;
  if (decision.status === "APPROVED") {
    payment = await db.$transaction(async (tx) => {
      const paymentNo = await nextNumber("payment");
      const created = await tx.payment.create({
        data: {
          paymentNo,
          invoiceId: claim.invoiceId,
          amount: claim.amount,
          method: "INSURANCE",
          reference: claim.claimNo,
          status: "COMPLETED",
          notes: `Insurance payout for claim ${claim.claimNo}`,
          receivedById: actor.userId,
          hospitalId: actor.hospitalId ?? null,
        },
      });
      const invoice = await tx.invoice.findUnique({ where: { id: claim.invoiceId } });
      if (!invoice) throw new ApiError(404, "Invoice not found");
      const paid = Math.round((invoice.paid + claim.amount) * 100) / 100;
      await tx.invoice.update({
        where: { id: claim.invoiceId },
        data: { paid, status: invoiceStatus(paid, invoice.total) },
      });
      return created;
    });
  }

  const updated = await db.insuranceClaim.update({
    where: { id },
    data: {
      status: decision.status === "APPROVED" ? "PAID" : "REJECTED",
      claimRef: decision.claimRef ?? claim.claimRef,
      notes: decision.notes ?? claim.notes,
      decisionById: actor.userId,
      decidedAt: new Date(),
    },
  });

  await logAudit({
    userId: actor.userId,
    action: "INSURANCE_CLAIM_DECIDED",
    entity: "InsuranceClaim",
    entityId: id,
    meta: { claimNo: claim.claimNo, decision: decision.status, payout: payment?.paymentNo ?? null },
  });
  return updated;
}
