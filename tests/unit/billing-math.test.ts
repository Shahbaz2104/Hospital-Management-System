import { describe, it, expect } from "vitest";
import { computeInvoiceTotals, invoiceStatus, toStripeAmount } from "@/services/billing";

/**
 * Billing is the one module where a maths bug is a financial bug. These are
 * pure exports, so no database is needed.
 */
describe("computeInvoiceTotals", () => {
  it("applies a fixed discount before tax", () => {
    const r = computeInvoiceTotals({
      subtotal: 100, discountType: "FIXED", discount: 20, taxRate: 10, insuranceCoverage: 0,
    });
    expect(r.discountAmount).toBe(20);
    expect(r.taxAmount).toBe(8); // (100 - 20) * 10%
    expect(r.total).toBe(88);
  });

  it("applies a percentage discount before tax", () => {
    const r = computeInvoiceTotals({
      subtotal: 200, discountType: "PERCENT", discount: 25, taxRate: 10, insuranceCoverage: 0,
    });
    expect(r.discountAmount).toBe(50);
    expect(r.taxAmount).toBe(15);
    expect(r.total).toBe(165);
  });

  it("caps a percentage discount at 100%", () => {
    const r = computeInvoiceTotals({
      subtotal: 100, discountType: "PERCENT", discount: 150, taxRate: 0, insuranceCoverage: 0,
    });
    expect(r.discountAmount).toBe(100);
    expect(r.total).toBe(0);
  });

  it("never discounts below zero subtotal", () => {
    const r = computeInvoiceTotals({
      subtotal: 50, discountType: "FIXED", discount: 500, taxRate: 0, insuranceCoverage: 0,
    });
    expect(r.discountAmount).toBe(50);
    expect(r.total).toBe(0);
  });

  it("subtracts insurance coverage from the taxed total", () => {
    const r = computeInvoiceTotals({
      subtotal: 1000, discountType: "FIXED", discount: 0, taxRate: 0, insuranceCoverage: 800,
    });
    expect(r.total).toBe(200);
  });

  it("clamps the total at zero when coverage exceeds the invoice", () => {
    const r = computeInvoiceTotals({
      subtotal: 100, discountType: "FIXED", discount: 0, taxRate: 0, insuranceCoverage: 500,
    });
    expect(r.total).toBe(0);
  });

  it("returns a total rounded to 2 decimal places", () => {
    const r = computeInvoiceTotals({
      subtotal: 33.33, discountType: "FIXED", discount: 0, taxRate: 7.5, insuranceCoverage: 0,
    });
    expect(r.total).toBe(Math.round(r.total * 100) / 100);
  });

  it("handles a zero-value invoice", () => {
    const r = computeInvoiceTotals({
      subtotal: 0, discountType: "FIXED", discount: 0, taxRate: 0, insuranceCoverage: 0,
    });
    expect(r).toEqual({ discountAmount: 0, taxAmount: 0, total: 0 });
  });
});

describe("invoiceStatus", () => {
  it("is PENDING when nothing has been paid", () => {
    expect(invoiceStatus(0, 100)).toBe("PENDING");
  });

  it("is PARTIAL when some but not all is paid", () => {
    expect(invoiceStatus(40, 100)).toBe("PARTIAL");
  });

  it("is PAID when fully settled", () => {
    expect(invoiceStatus(100, 100)).toBe("PAID");
  });

  it("treats a tiny rounding residue as paid (EPSILON tolerance)", () => {
    expect(invoiceStatus(99.995, 100)).toBe("PAID");
  });

  it("is PAID for a zero-total invoice (nothing is owed)", () => {
    // A fully insurance-covered or fully discounted invoice has total 0.
    // Reporting PENDING would wrongly imply money is outstanding.
    expect(invoiceStatus(0, 0)).toBe("PAID");
  });
});

describe("toStripeAmount", () => {
  it("converts two-decimal currencies to minor units", () => {
    expect(toStripeAmount(120.5, "USD")).toBe(12050);
    expect(toStripeAmount(10, "EUR")).toBe(1000);
  });

  it("does not multiply zero-decimal currencies", () => {
    expect(toStripeAmount(1200, "JPY")).toBe(1200);
    expect(toStripeAmount(999.6, "KRW")).toBe(1000);
  });

  it("is case-insensitive on the currency code", () => {
    expect(toStripeAmount(500, "jpy")).toBe(500);
  });

  it("rounds to the nearest integer minor unit", () => {
    expect(toStripeAmount(10.005, "USD")).toBe(1001);
  });

  it("handles zero", () => {
    expect(toStripeAmount(0, "USD")).toBe(0);
  });
});