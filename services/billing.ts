import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { nextSeq } from "@/lib/sequences";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { notify } from "@/services/notifications";
import { z } from "zod";
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
  if (kind === "invoice") return nextSeq(() => db.invoice.findMany({ select: { invoiceNo: true } }), "invoiceNo", "INV");
  if (kind === "payment") return nextSeq(() => db.payment.findMany({ select: { paymentNo: true } }), "paymentNo", "PAY");
  if (kind === "claim") return nextSeq(() => db.insuranceClaim.findMany({ select: { claimNo: true } }), "claimNo", "CLM");
  if (kind === "policy") return nextSeq(() => db.insurancePolicy.findMany({ select: { policyNumber: true } }), "policyNumber", "POL");
  return nextSeq(() => db.insuranceCompany.findMany({ select: { code: true } }), "code", "IC");
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

  return invoice;
}

export async function cancelInvoice(_actor: Actor, id: string) {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.status === "CANCELLED") throw new ApiError(409, "Invoice already cancelled");
  if (invoice.paid > EPSILON) throw new ApiError(409, "Cannot cancel an invoice with recorded payments");
  return db.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
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

    // Online payments (CARD via Stripe) are refunded through the gateway;
    // the negative ledger row below records the gateway refund id.
    let stripeRefundId: string | null = null;
    if (freshPayment.method === "CARD" && freshPayment.stripePaymentIntentId) {
      if (!isStripeConfigured()) {
        throw new ApiError(503, "Stripe is not configured — cannot refund an online payment");
      }
      const currency = await invoiceCurrency(freshPayment.invoiceId);
      try {
        const gatewayRefund = await stripe().refunds.create({
          payment_intent: freshPayment.stripePaymentIntentId,
          amount: toStripeAmount(input.amount, currency),
        });
        stripeRefundId = gatewayRefund.id;
      } catch (e) {
        throw new ApiError(
          502,
          `Stripe refund failed: ${e instanceof Error ? e.message : "unknown error"}`
        );
      }
    }

    const refund = await tx.payment.create({
      data: {
        paymentNo: refundNo,
        invoiceId: freshPayment.invoiceId,
        amount: -input.amount,
        method: freshPayment.method,
        status: "COMPLETED",
        notes: input.reason,
        refundOfId: freshPayment.id,
        stripeRefundId,
        stripePaymentIntentId: freshPayment.stripePaymentIntentId,
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
  return company;
}

export async function updateInsuranceCompany(actor: Actor, id: string, input: Partial<z.infer<typeof insuranceCompanySchema>>) {
  const existing = await db.insuranceCompany.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Insurance company not found");
  const company = await db.insuranceCompany.update({ where: { id }, data: input });
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
    data: { insuranceProvider: company.name, insuranceNumber: policyNumber },
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

  if (decision.status === "APPROVED") {
    await db.$transaction(async (tx) => {
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

  return updated;
}

// ---------------------------------------------------------------------------
// Stripe online payments (checkout sessions, webhooks, gateway refunds)
// ---------------------------------------------------------------------------

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "IDR", "CLP", "ISK", "BYR"]);

export function toStripeAmount(amount: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}

async function invoiceCurrency(invoiceId: string): Promise<string> {
  const hospital = await db.hospital.findUnique({
    where: { id: (await db.invoice.findUnique({ where: { id: invoiceId }, select: { hospitalId: true } }))?.hospitalId ?? "" },
    select: { currency: true },
  });
  return hospital?.currency ?? "USD";
}

/**
 * Creates (or reuses an open) Stripe Checkout Session for the outstanding
 * balance of an invoice. A PENDING payment row is recorded so the pay link
 * and webhook have a stable handle; partial payments accumulate via the
 * webhook's invoice-paid recomputation.
 */
export async function createCheckoutSession(actor: Actor, invoiceId: string) {
  if (!isStripeConfigured()) {
    throw new ApiError(503, "Stripe is not configured — set STRIPE_SECRET_KEY");
  }

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, email: true } },
      payments: { select: { id: true, status: true, stripeSessionId: true, stripePaymentIntentId: true } },
    },
  });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.status === "CANCELLED" || invoice.status === "REFUNDED") {
    throw new ApiError(409, `Cannot pay a ${invoice.status.toLowerCase()} invoice`);
  }

  const due = Math.round((invoice.total - invoice.paid) * 100) / 100;
  if (due <= EPSILON) throw new ApiError(409, "Invoice is already fully paid");

  // Reuse an open checkout session (idempotent pay-link sharing).
  const pending = invoice.payments.find(
    (p) => p.status === "PENDING" && p.stripeSessionId && !p.stripePaymentIntentId
  );
  if (pending?.stripeSessionId) {
    const session = await stripe().checkout.sessions.retrieve(pending.stripeSessionId);
    if (session.status === "open" && session.url) {
      return { url: session.url, sessionId: session.id, paymentNo: undefined };
    }
    await db.payment.update({ where: { id: pending.id }, data: { status: "CANCELLED" } });
  }

  const currency = await invoiceCurrency(invoice.id);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: invoice.id,
    metadata: { invoiceId: invoice.id, hospitalId: actor.hospitalId ?? "", initiatedBy: actor.userId },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `Invoice ${invoice.invoiceNo}`,
            description: `Payment for ${invoice.patient.firstName} ${invoice.patient.lastName} (${invoice.patient.patientNo})`,
          },
          unit_amount: toStripeAmount(due, currency),
        },
      },
    ],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/payments?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/billing`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  });
  if (!session.url) throw new ApiError(502, "Stripe did not return a checkout URL");

  const paymentNo = await nextNumber("payment");
  await db.payment.create({
    data: {
      paymentNo,
      invoiceId: invoice.id,
      amount: due,
      method: "CARD",
      status: "PENDING",
      reference: session.id,
      stripeSessionId: session.id,
      notes: "Awaiting online payment (Stripe)",
      receivedById: actor.userId,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  return { url: session.url, sessionId: session.id, paymentNo };
}

/** Recompute invoice.paid from its completed payments — idempotent. */
async function recomputeInvoicePaid(
  tx: { payment: typeof db.payment; invoice: typeof db.invoice },
  invoiceId: string
) {
  const [agg, invoice] = await Promise.all([
    tx.payment.aggregate({ where: { invoiceId, status: "COMPLETED" }, _sum: { amount: true } }),
    tx.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, total: true } }),
  ]);
  if (!invoice) throw new ApiError(404, "Invoice not found");
  const paid = Math.round((agg._sum.amount ?? 0) * 100) / 100;
  const status = paid <= -EPSILON ? "REFUNDED" : invoiceStatus(paid, invoice.total);
  return tx.invoice.update({ where: { id: invoiceId }, data: { paid, status } });
}

export async function completeStripeCheckout(session: {
  id: string;
  payment_status: string | null;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
  payment_intent: string | null;
}) {
  const existing = await db.payment.findFirst({ where: { stripeSessionId: session.id } });
  if (session.payment_status !== "paid") {
    if (existing && existing.status === "PENDING") {
      await db.payment.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });
    }
    return null;
  }
  if (!existing) return null; // only sessions we created are processed

  if (existing.status === "COMPLETED") return existing; // webhook retry — idempotent

  const currency = session.currency ?? "usd";
  const amount = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? session.amount_total ?? 0
    : Math.round((session.amount_total ?? 0) / 100 * 100) / 100;

  const paymentIntentId = session.payment_intent;
  let chargeId: string | null = null;
  if (paymentIntentId) {
    const intent = await stripe().paymentIntents.retrieve(paymentIntentId);
    chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : null;
  }

  const updated = await db.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: existing.id },
      data: {
        status: "COMPLETED",
        amount,
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: chargeId,
        notes: "Paid online via Stripe",
      },
    });
    await recomputeInvoicePaid(tx, existing.invoiceId);
    return payment;
  });

  // Notify billing staff + the patient, and send a receipt email.
  const invoice = await db.invoice.findUnique({
    where: { id: existing.invoiceId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (invoice) {
    await notify({
      roles: ["ACCOUNTANT", "HOSPITAL_ADMIN", "RECEPTIONIST"],
      title: `Payment received — ${invoice.invoiceNo}`,
      message: `${invoice.patient.firstName} ${invoice.patient.lastName} paid ${amount.toFixed(2)} online.`,
      type: "BILLING",
      entity: "Invoice",
      entityId: invoice.id,
      hospitalId: invoice.hospitalId,
    });
    if (invoice.patient.email) {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: invoice.patient.email,
        subject: `Payment received — ${invoice.invoiceNo}`,
        text: `Dear ${invoice.patient.firstName},\n\nWe received your online payment of ${amount.toFixed(2)} for invoice ${invoice.invoiceNo}. Thank you!\n\n— City Care Hospital`,
        html: `<p>Dear ${invoice.patient.firstName},</p><p>We received your online payment of <strong>${amount.toFixed(2)}</strong> for invoice <strong>${invoice.invoiceNo}</strong>.</p><p>Thank you!</p>`,
      }).catch(() => {});
    }
  }

  return updated;
}

export async function expireStripeCheckout(sessionId: string) {
  const pending = await db.payment.findFirst({
    where: { stripeSessionId: sessionId, status: "PENDING" },
  });
  if (pending) {
    await db.payment.update({ where: { id: pending.id }, data: { status: "CANCELLED" } });
  }
}

/** Sync a succeeded Stripe refund into the local ledger (reconciliation). */
export async function syncStripeRefund(refund: {
  id: string;
  status: string;
  payment_intent: string | null;
  amount: number;
  currency: string;
}) {
  if (refund.status !== "succeeded") return null;
  const payment = await db.payment.findFirst({
    where: { stripePaymentIntentId: refund.payment_intent },
  });
  if (!payment || payment.amount <= 0) return null;
  if (payment.stripeRefundId === refund.id) return null; // already applied

  const currency = refund.currency;
  const amount = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? refund.amount
    : Math.round((refund.amount / 100) * 100) / 100;

  const refundNo = await nextNumber("payment");
  const applied = await db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        paymentNo: refundNo,
        invoiceId: payment.invoiceId,
        amount: -amount,
        method: "CARD",
        status: "COMPLETED",
        notes: `Stripe refund ${refund.id}`,
        refundOfId: payment.id,
        stripeRefundId: refund.id,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        hospitalId: payment.hospitalId,
      },
    });
    const refundedAgg = await tx.payment.aggregate({
      where: { refundOfId: payment.id },
      _sum: { amount: true },
    });
    if (Math.abs(refundedAgg._sum.amount ?? 0) >= payment.amount - EPSILON) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    }
    await recomputeInvoicePaid(tx, payment.invoiceId);
    return created;
  });
  return applied;
}
