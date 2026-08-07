import { z } from "zod";

export const INVOICE_ITEM_TYPES = [
  "CONSULTATION",
  "LAB",
  "RADIOLOGY",
  "PHARMACY",
  "WARD",
  "PROCEDURE",
  "OTHER",
] as const;

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "MOBILE_WALLET",
  "INSURANCE",
] as const;

export const DISCOUNT_TYPES = ["FIXED", "PERCENT"] as const;

export const invoiceItemSchema = z.object({
  type: z.enum(INVOICE_ITEM_TYPES).default("OTHER"),
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be at least 0.01").default(1),
  unitPrice: z.coerce.number().min(0).default(0),
});

export const createInvoiceSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  admissionId: z.string().optional(),
  appointmentId: z.string().optional(),
  consultationId: z.string().optional(),
  insurancePolicyId: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item"),
  discountType: z.enum(DISCOUNT_TYPES).default("FIXED"),
  discount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional(),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.coerce.number().positive("Payment amount must be positive"),
  method: z.enum(PAYMENT_METHODS).default("CASH"),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const refundSchema = z.object({
  paymentId: z.string().min(1, "Payment is required"),
  amount: z.coerce.number().positive("Refund amount must be positive"),
  reason: z.string().trim().min(2, "Refund reason is required"),
});

export const insuranceCompanySchema = z.object({
  name: z.string().trim().min(2, "Company name is required"),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().trim().optional(),
  coveragePercent: z.coerce.number().min(0).max(100).default(80),
  claimPhone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  active: z.boolean().default(true),
});

export const insurancePolicySchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  companyId: z.string().min(1, "Insurance company is required"),
  policyNumber: z.string().trim().min(2, "Policy number is required").optional(),
  coveragePercent: z.coerce.number().min(0).max(100).default(80),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});

export const createClaimSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  policyId: z.string().min(1, "Policy is required"),
  amount: z.coerce.number().positive("Claim amount must be positive"),
  claimRef: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const claimDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  claimRef: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
