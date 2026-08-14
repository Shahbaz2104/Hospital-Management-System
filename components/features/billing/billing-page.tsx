"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Banknote,
  CircleDollarSign,
  Eye,
  ExternalLink,
  FileDown,
  FileText,
  Link2,
  Loader2,
  Plus,
  Printer,
  Receipt,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { createInvoiceSchema, DISCOUNT_TYPES, INVOICE_ITEM_TYPES, PAYMENT_METHODS, recordPaymentSchema } from "@/validators/billing";

type PatientOption = { id: string; patientNo: string; firstName: string; lastName: string };
type PolicyOption = {
  id: string;
  policyNumber: string;
  coveragePercent: number;
  status: string;
  patientId: string;
  company: { id: string; name: string };
};

type InvoiceRow = {
  id: string;
  invoiceNo: string;
  patient: PatientOption;
  items: { amount: number }[];
  payments: { amount: number }[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  insuranceCoverage: number;
  total: number;
  paid: number;
  status: string;
  createdAt: string;
};

type InvoiceDetail = {
  id: string;
  invoiceNo: string;
  patient: PatientOption;
  subtotal: number;
  discount: number;
  discountType: "FIXED" | "PERCENT";
  taxRate: number;
  taxAmount: number;
  insuranceCoverage: number;
  total: number;
  paid: number;
  status: string;
  notes: string | null;
  createdAt: string;
  items: { id: string; type: string; description: string; quantity: number; unitPrice: number; amount: number }[];
  payments: {
    id: string;
    paymentNo: string;
    amount: number;
    method: string;
    status: string;
    reference: string | null;
    notes: string | null;
    paidAt: string;
    refundOfId: string | null;
    receivedBy: { firstName: string; lastName: string } | null;
  }[];
  claim: { id: string; claimNo: string; amount: number; status: string } | null;
  insurancePolicy: { id: string; policyNumber: string; company: { name: string } } | null;
  issuedBy: { firstName: string; lastName: string } | null;
};

type Summary = {
  todayRevenue: number;
  monthRevenue: number;
  outstanding: number;
  pendingBills: number;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  PARTIAL: { label: "Partial", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  PAID: { label: "Paid", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  REFUNDED: { label: "Refunded", cls: "bg-slate-500/10 text-slate-500 dark:text-slate-400 dark:text-slate-400" },
  CANCELLED: { label: "Cancelled", cls: "bg-destructive/10 text-destructive" },
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  MOBILE_WALLET: "Mobile wallet",
  INSURANCE: "Insurance",
};

const money = (n: number) => `$${n.toFixed(2)}`;

export function BillingPage() {
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);
  const [refundOf, setRefundOf] = React.useState<{ id: string; paymentNo: string; amount: number } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["invoices", statusFilter, search],
    queryFn: () =>
      apiGet<{ items: InvoiceRow[]; total: number }>("/billing/invoices", {
        status: statusFilter,
        search: search || undefined,
        page: 1,
        pageSize: 100,
      }),
  });

  const { data: summary } = useQuery({
    queryKey: ["billing-summary"],
    queryFn: () => apiGet<Summary>("/billing/summary"),
  });

  const { data: patients } = useQuery({
    queryKey: ["patients", "options"],
    queryFn: () => apiGet<{ items: PatientOption[] }>("/patients", { page: 1, pageSize: 100 }),
  });

  const { data: policies } = useQuery({
    queryKey: ["insurance-policies"],
    queryFn: () => apiGet<{ items: PolicyOption[] }>("/billing/policies"),
  });

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ["invoice-detail", detailId],
    queryFn: () => apiGet<InvoiceDetail>(`/billing/invoices/${detailId}`),
    enabled: !!detailId,
  });

  function onPrint(invoice: InvoiceDetail | InvoiceRow) {
    const items = invoice.items.map((i) => {
      const full = i as Partial<InvoiceDetail["items"][number]>;
      return {
        amount: i.amount,
        description: full.description ?? "",
        quantity: full.quantity ?? 1,
      };
    });
    const payments = invoice.payments.map((p) => {
      const full = p as Partial<InvoiceDetail["payments"][number]>;
      return {
        amount: p.amount,
        paymentNo: full.paymentNo ?? "",
        method: full.method ?? "CASH",
        paidAt: full.paidAt ?? invoice.createdAt,
      };
    });
    const discountType = "discountType" in invoice ? invoice.discountType : "FIXED";
    const taxRate = "taxRate" in invoice ? invoice.taxRate : 0;
    const w = window.open("", "_blank", "width=760,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Invoice — ${invoice.invoiceNo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f1f5f9;padding:32px;color:#0f172a}
        .sheet{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;max-width:640px;margin:0 auto}
        .head{background:#0f172a;color:#fff;padding:20px 28px;display:flex;justify-content:space-between;align-items:flex-start}
        .head h1{font-size:18px;font-weight:800;letter-spacing:-.02em}
        .head p{font-size:11px;opacity:.8;margin-top:2px}
        .invno{text-align:right;font-family:ui-monospace,monospace;font-size:13px;color:#7FB8AE;font-weight:700}
        .body{padding:24px 28px}
        .row{display:flex;justify-content:space-between;font-size:12px;color:#64748b;padding:3px 0}
        table{width:100%;border-collapse:collapse;margin:16px 0}
        th{text-align:left;padding:8px 0;border-bottom:2px solid #e2e8f0;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
        td{padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
        td:last-child,th:last-child{text-align:right}
        .totals{margin-top:16px;border-top:2px dashed #e2e8f0;padding-top:12px}
        .tl{display:flex;justify-content:space-between;font-size:12px;color:#475569;padding:3px 0}
        .grand{margin-top:6px;padding-top:10px;border-top:2px solid #0f172a;display:flex;justify-content:space-between;font-size:16px;font-weight:800}
        .paid{margin-top:12px;padding-top:10px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;font-size:12px;color:#059669;font-weight:700}
        .bal{display:flex;justify-content:space-between;font-size:13px;color:#dc2626;font-weight:700;padding-top:6px}
        .foot{background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 28px;font-size:10px;color:#94a3b8;text-align:center}
      </style></head><body><div class="sheet">
        <div class="head">
          <div><h1>City Care Hospital</h1><p>123 Wellness Avenue · +(1) 555 0100</p></div>
          <div class="invno">${invoice.invoiceNo}</div>
        </div>
        <div class="body">
          <div class="row"><span>Patient</span><span>${invoice.patient.firstName} ${invoice.patient.lastName} (${invoice.patient.patientNo})</span></div>
          <div class="row"><span>Date</span><span>${format(new Date(invoice.createdAt), "MMM d, yyyy HH:mm")}</span></div>
          <div class="row"><span>Status</span><span>${invoice.status}</span></div>
          <table>
            <thead><tr><th>Description</th><th style="text-align:center">Qty</th><th>Amount</th></tr></thead>
            <tbody>
              ${items.map((i) => `<tr><td>${i.description}</td><td style="text-align:center">${i.quantity}</td><td>${money(i.amount)}</td></tr>`).join("")}
            </tbody>
          </table>
          <div class="totals">
            <div class="tl"><span>Subtotal</span><span>${money(invoice.subtotal)}</span></div>
            <div class="tl"><span>Discount (${discountType === "PERCENT" ? "percent" : "fixed"})</span><span>− ${money(invoice.discount)}</span></div>
            <div class="tl"><span>Tax (${taxRate}%)</span><span>${money(invoice.taxAmount)}</span></div>
            ${invoice.insuranceCoverage > 0 ? `<div class="tl"><span>Insurance coverage</span><span>− ${money(invoice.insuranceCoverage)}</span></div>` : ""}
            <div class="grand"><span>Total due</span><span>${money(invoice.total)}</span></div>
            <div class="paid"><span>Paid</span><span>${money(invoice.paid)}</span></div>
            <div class="bal"><span>Balance</span><span>${money(Math.max(0, invoice.total - invoice.paid))}</span></div>
          </div>
          ${payments.filter((p) => p.amount > 0).length > 0 ? `
            <table style="margin-top:20px">
              <thead><tr><th>Payment</th><th style="text-align:center">Method</th><th>Amount</th></tr></thead>
              <tbody>
                ${payments.filter((p) => p.amount > 0).map((p) => `<tr><td>${p.paymentNo ?? ""} · ${format(new Date(p.paidAt), "MMM d, yyyy")}</td><td style="text-align:center">${METHOD_LABELS[p.method] ?? p.method}</td><td>${money(p.amount)}</td></tr>`).join("")}
              </tbody>
            </table>` : ""}
        </div>
        <div class="foot">Thank you for choosing City Care Hospital · This is a computer-generated invoice</div>
      </div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  function onPrintRow(row: InvoiceRow) {
    onPrint(row);
  }

  async function openCheckout(invoiceId: string) {
    try {
      const res = await apiPost<{ url: string }>(`/billing/invoices/${invoiceId}/checkout`);
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open checkout");
    }
  }

  async function copyPayLink(invoiceId: string) {
    try {
      const res = await apiGet<{ url: string }>(`/billing/invoices/${invoiceId}/pay-link`);
      await navigator.clipboard.writeText(res.url);
      toast.success("Payment link copied to clipboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create payment link");
    }
  }

  return (
    <div>
      <PageHeader title="Billing" description="Invoices, payments and refunds">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New invoice
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue today" icon={Banknote} value={summary?.todayRevenue} loading={!summary} />
        <StatCard label="Revenue this month" icon={CircleDollarSign} value={summary?.monthRevenue} loading={!summary} />
        <StatCard label="Outstanding" icon={Receipt} value={summary?.outstanding} loading={!summary} hint="Pending + partial balances" />
        <StatCard label="Pending bills" icon={FileText} value={summary?.pendingBills} loading={!summary} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="PARTIAL">Partial</TabsTrigger>
            <TabsTrigger value="PAID">Paid</TabsTrigger>
            <TabsTrigger value="REFUNDED">Refunded</TabsTrigger>
            <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative ml-auto w-full max-w-xs">
          <Input
            placeholder="Search invoice no. or patient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (data?.items ?? []).length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No invoices found{statusFilter !== "ALL" ? " for this status" : " yet"}.
          </p>
        ) : (
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((inv) => {
                const badge = STATUS_BADGE[inv.status] ?? { label: inv.status, cls: "" };
                const balance = Math.max(0, inv.total - inv.paid);
                return (
                  <tr key={inv.id} className="cursor-pointer" onClick={() => setDetailId(inv.id)}>
                    <td className="px-4 py-3 font-medium tabular-nums">{inv.invoiceNo}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{inv.patient.firstName} {inv.patient.lastName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{inv.patient.patientNo}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(inv.createdAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{money(inv.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{money(inv.paid)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-destructive">{money(balance)}</td>
                    <td className="px-4 py-3">
                      <Badge className={badge.cls}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDetailId(inv.id)} title="View invoice">
                          <Eye />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => onPrintRow(inv)} title="Print invoice">
                          <Printer />
                        </Button>
                        {balance > 0 && inv.status !== "CANCELLED" && inv.status !== "REFUNDED" && (
                          <>
                            <Button variant="ghost" size="icon-sm" onClick={() => void openCheckout(inv.id)} title="Pay online (Stripe)">
                              <ExternalLink />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => void copyPayLink(inv.id)} title="Copy payment link">
                              <Link2 />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        patients={patients?.items ?? []}
        policies={policies?.items ?? []}
        onSaved={() => {
          refetch();
          refetchDetail();
        }}
      />

      <InvoiceDetailDialog
        detail={detail}
        loading={!!detailId && !detail}
        onClose={() => setDetailId(null)}
        onOpenPay={() => setPayOpen(true)}
        onPayOnline={() => detail && void openCheckout(detail.id)}
        onCopyLink={() => detail && void copyPayLink(detail.id)}
        onRefund={setRefundOf}
        onCancelInvoice={async () => {
          if (!detail) return;
          if (!confirm(`Cancel invoice ${detail.invoiceNo}?`)) return;
          try {
            await apiPatch(`/billing/invoices/${detail.id}`, { action: "cancel" });
            toast.success("Invoice cancelled");
            refetch();
            refetchDetail();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Cancel failed");
          }
        }}
        onPrint={() => detail && onPrint(detail)}
      />

      <RecordPaymentDialog
        detail={detail}
        open={payOpen}
        onOpenChange={setPayOpen}
        onSaved={() => {
          refetch();
          refetchDetail();
        }}
      />

      <RefundDialog
        refundOf={refundOf}
        onClose={() => setRefundOf(null)}
        onSaved={() => {
          refetch();
          refetchDetail();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create invoice
// ---------------------------------------------------------------------------

function CreateInvoiceDialog({
  open,
  onOpenChange,
  patients,
  policies,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: PatientOption[];
  policies: PolicyOption[];
  onSaved: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const form = useForm<z.input<typeof createInvoiceSchema>>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      patientId: "",
      insurancePolicyId: "",
      items: [{ type: "CONSULTATION", description: "", quantity: 1, unitPrice: 0 }],
      discountType: "FIXED",
      discount: 0,
      taxRate: 0,
      notes: "",
    },
  });

  const items = form.watch("items") ?? [];
  const discountType = form.watch("discountType");
  const discount = form.watch("discount") ?? 0;
  const taxRate = form.watch("taxRate") ?? 0;
  const patientId = form.watch("patientId");
  const selectedPolicyId = form.watch("insurancePolicyId");

  const patientPolicies = policies.filter((p) => p.patientId === patientId && p.status === "ACTIVE");
  const selectedPolicy = patientPolicies.find((p) => p.id === selectedPolicyId);

  React.useEffect(() => {
    if (open) {
      form.reset({
        patientId: "",
        insurancePolicyId: "",
        items: [{ type: "CONSULTATION", description: "", quantity: 1, unitPrice: 0 }],
        discountType: "FIXED",
        discount: 0,
        taxRate: 0,
        notes: "",
      });
    }
  }, [open, form]);

  React.useEffect(() => {
    if (!patientPolicies.some((p) => p.id === selectedPolicyId)) {
      form.setValue("insurancePolicyId", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const discountAmount = discountType === "PERCENT"
    ? subtotal * Math.min(discount, 100) / 100
    : Math.min(discount, subtotal);
  const coverage = selectedPolicy
    ? (subtotal - discountAmount) * (selectedPolicy.coveragePercent / 100)
    : 0;
  const total = Math.max(0, subtotal - discountAmount + (subtotal - discountAmount) * (taxRate / 100) - coverage);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  async function onCreate(values: z.input<typeof createInvoiceSchema>) {
    setPending(true);
    try {
      await apiPost("/billing/invoices", {
        ...values,
        items: values.items.map((i) => ({ ...i, description: i.description.trim() })).filter((i) => i.description),
      });
      toast.success("Invoice created");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create invoice");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription>
            Bill a patient for services, procedures or items.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select patient" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.firstName} {p.lastName} · {p.patientNo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="insurancePolicyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insurance policy</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None (self pay)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (self pay)</SelectItem>
                        {patientPolicies.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.company.name} · {p.policyNumber} ({p.coveragePercent}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Line items
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => append({ type: "OTHER", description: "", quantity: 1, unitPrice: 0 })}
                >
                  <Plus /> Add item
                </Button>
              </div>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.type`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-3">
                          <Select value={f.value} onValueChange={f.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {INVOICE_ITEM_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-5">
                          <FormControl>
                            <Input placeholder="Description (e.g. Consultation fee)" {...f} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-1">
                          <FormControl>
                            <Input type="number" min={0.01} step={0.01} {...f} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-2">
                          <FormControl>
                            <Input type="number" min={0} step={0.01} {...f} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="col-span-1 flex items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DISCOUNT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t === "FIXED" ? "Fixed ($)" : "Percent (%)"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.01} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={0.01} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Optional notes for this invoice" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between py-0.5 text-muted-foreground">
                <span>Subtotal</span><span className="tabular-nums">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-muted-foreground">
                <span>Discount</span><span className="tabular-nums">− {money(discountAmount)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-muted-foreground">
                <span>Tax ({taxRate}%)</span><span className="tabular-nums">{money((subtotal - discountAmount) * taxRate / 100)}</span>
              </div>
              {selectedPolicy && (
                <div className="flex justify-between py-0.5 text-muted-foreground">
                  <span>Insurance coverage ({selectedPolicy.company.name})</span>
                  <span className="tabular-nums">− {money(coverage)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total due</span><span className="tabular-nums">{money(total)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Create invoice
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Invoice detail
// ---------------------------------------------------------------------------

function InvoiceDetailDialog({
  detail,
  loading,
  onClose,
  onOpenPay,
  onPayOnline,
  onCopyLink,
  onRefund,
  onCancelInvoice,
  onPrint,
}: {
  detail?: InvoiceDetail;
  loading: boolean;
  onClose: () => void;
  onOpenPay: () => void;
  onPayOnline: () => void;
  onCopyLink: () => void;
  onRefund: (payment: { id: string; paymentNo: string; amount: number }) => void;
  onCancelInvoice: () => void;
  onPrint: () => void;
}) {
  return (
    <Dialog open={!!detail || loading} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-4" /> Invoice {detail?.invoiceNo}
            {detail && <Badge className={STATUS_BADGE[detail.status]?.cls}>{STATUS_BADGE[detail.status]?.label ?? detail.status}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {detail
              ? `${detail.patient.firstName} ${detail.patient.lastName} · ${detail.patient.patientNo} · ${format(new Date(detail.createdAt), "MMM d, yyyy HH:mm")}`
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {loading && !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : detail ? (
          <div className="space-y-4">
            {detail.insurancePolicy && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                <span className="font-semibold">Insurance:</span>{" "}
                {detail.insurancePolicy.company.name} · {detail.insurancePolicy.policyNumber}
                {detail.claim && (
                  <span className="ml-2 text-muted-foreground">
                    · Claim {detail.claim.claimNo} ({detail.claim.status})
                  </span>
                )}
              </div>
            )}

            <div className="rounded-lg border">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2 text-center">Qty</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-2">{i.description}</td>
                      <td className="px-4 py-2 text-center tabular-nums">{i.quantity}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(i.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between py-0.5 text-muted-foreground">
                <span>Subtotal</span><span className="tabular-nums">{money(detail.subtotal)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-muted-foreground">
                <span>Discount ({detail.discountType === "PERCENT" ? "percent" : "fixed"})</span>
                <span className="tabular-nums">− {money(detail.discount)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-muted-foreground">
                <span>Tax ({detail.taxRate}%)</span><span className="tabular-nums">{money(detail.taxAmount)}</span>
              </div>
              {detail.insuranceCoverage > 0 && (
                <div className="flex justify-between py-0.5 text-muted-foreground">
                  <span>Insurance coverage</span>
                  <span className="tabular-nums">− {money(detail.insuranceCoverage)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span><span className="tabular-nums">{money(detail.total)}</span>
              </div>
              <div className="flex justify-between pt-1 text-emerald-600 dark:text-emerald-400">
                <span>Paid</span><span className="tabular-nums">{money(detail.paid)}</span>
              </div>
              <div className="flex justify-between pt-1 font-semibold text-destructive">
                <span>Balance</span><span className="tabular-nums">{money(Math.max(0, detail.total - detail.paid))}</span>
              </div>
            </div>

            {detail.payments.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Payments
                </p>
                <div className="rounded-lg border">
                  <table className="data-table w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2">Payment</th>
                        <th className="px-4 py-2">Method</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-right">Refund</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-2">
                            <span className="tabular-nums">{p.paymentNo}</span>
                            {p.status === "REFUNDED" && (
                              <Badge className="ml-2 bg-slate-500/10 text-slate-500 dark:text-slate-400">Refunded</Badge>
                            )}
                            <span className="block text-xs text-muted-foreground">
                              {format(new Date(p.paidAt), "MMM d, yyyy HH:mm")}
                              {p.receivedBy ? ` · ${p.receivedBy.firstName} ${p.receivedBy.lastName}` : ""}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {p.refundOfId ? `Refund of ${p.paymentNo}` : (METHOD_LABELS[p.method] ?? p.method)}
                          </td>
                          <td className={`px-4 py-2 text-right font-medium tabular-nums ${p.amount < 0 ? "text-destructive" : ""}`}>
                            {p.amount < 0 ? "−" : ""}{money(Math.abs(p.amount))}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {p.amount > 0 && p.status === "COMPLETED" && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Download receipt (PDF)"
                                  onClick={() => window.open(`/api/payments/${p.id}/receipt`, "_blank")}
                                >
                                  <FileDown />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Refund this payment"
                                  onClick={() => onRefund({ id: p.id, paymentNo: p.paymentNo, amount: p.amount })}
                                >
                                  <Undo2 />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detail.notes && (
              <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {detail.notes}
              </p>
            )}

            <DialogFooter className="flex-wrap gap-2">
              {detail.status !== "CANCELLED" && detail.paid === 0 && (
                <Button variant="outline" onClick={onCancelInvoice}>
                  <XCircle className="size-4" /> Cancel invoice
                </Button>
              )}
              <Button variant="outline" onClick={onPrint}>
                <Printer className="size-4" /> Print
              </Button>
              {detail.status !== "CANCELLED" && detail.status !== "REFUNDED" && detail.paid < detail.total - 0.009 && (
                <>
                  <Button variant="outline" onClick={onPayOnline}>
                    <ExternalLink className="size-4" /> Pay online
                  </Button>
                  <Button variant="outline" onClick={onCopyLink}>
                    <Link2 className="size-4" /> Copy payment link
                  </Button>
                  <Button onClick={onOpenPay}>
                    <Banknote className="size-4" /> Record payment
                  </Button>
                </>
              )}
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Record payment
// ---------------------------------------------------------------------------

function RecordPaymentDialog({
  detail,
  open,
  onOpenChange,
  onSaved,
}: {
  detail?: InvoiceDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const balance = detail ? Math.max(0, detail.total - detail.paid) : 0;

  const form = useForm<z.input<typeof recordPaymentSchema>>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: { invoiceId: "", amount: 0, method: "CASH", reference: "", notes: "" },
  });

  React.useEffect(() => {
    if (open && detail) {
      form.reset({ invoiceId: detail.id, amount: balance, method: "CASH", reference: "", notes: "" });
    }
  }, [open, detail, form, balance]);

  async function onPay(values: z.input<typeof recordPaymentSchema>) {
    setPending(true);
    try {
      await apiPost("/billing/payments", values);
      toast.success("Payment recorded");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {detail ? `${detail.invoiceNo} · Balance ${money(balance)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onPay)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" min={0.01} step={0.01} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="Txn / cheque no" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Record payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Refund
// ---------------------------------------------------------------------------

function RefundDialog({
  refundOf,
  onClose,
  onSaved,
}: {
  refundOf: { id: string; paymentNo: string; amount: number } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (refundOf) {
      setAmount(String(refundOf.amount));
      setReason("");
    }
  }, [refundOf]);

  async function onRefund() {
    if (!refundOf) return;
    setPending(true);
    try {
      await apiPost("/billing/payments/refund", {
        paymentId: refundOf.id,
        amount: Number(amount),
        reason,
      });
      toast.success("Refund processed");
      onClose();
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refund failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={!!refundOf} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refund payment</DialogTitle>
          <DialogDescription>
            {refundOf ? `${refundOf.paymentNo} · original amount ${money(refundOf.amount)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Amount</label>
            <Input
              type="number"
              min={0.01}
              max={refundOf?.amount}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Reason</label>
            <Input
              placeholder="e.g. Service cancelled, overpayment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={pending || !amount || Number(amount) <= 0 || !reason.trim()}
              onClick={onRefund}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Process refund
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
