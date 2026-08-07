"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CreditCard, Undo2, Wallet } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import { PAYMENT_METHODS } from "@/validators/billing";

type PaymentRow = {
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
  invoice: {
    invoiceNo: string;
    total: number;
    paid: number;
    patient: { patientNo: string; firstName: string; lastName: string };
  };
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  MOBILE_WALLET: "Mobile wallet",
  INSURANCE: "Insurance",
};

const money = (n: number) => `$${n.toFixed(2)}`;

export function PaymentsPage() {
  const [methodFilter, setMethodFilter] = React.useState("ALL");
  const [search, setSearch] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["payments", methodFilter, search],
    queryFn: () =>
      apiGet<{ items: PaymentRow[] }>("/billing/payments", {
        method: methodFilter,
        search: search || undefined,
      }),
  });

  const payments = data?.items ?? [];
  const collected = payments.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
  const refunded = payments.filter((p) => p.amount < 0).reduce((s, p) => s + Math.abs(p.amount), 0);

  return (
    <div>
      <PageHeader title="Payments" description="Payment ledger across all invoices" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected (shown)" icon={Wallet} value={collected} loading={isLoading} />
        <StatCard label="Refunded (shown)" icon={Undo2} value={refunded} loading={isLoading} hint="Negative entries" />
        <StatCard label="Net received" icon={CreditCard} value={collected - refunded} loading={isLoading} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={methodFilter} onValueChange={setMethodFilter}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="ALL">All</TabsTrigger>
            {PAYMENT_METHODS.map((m) => (
              <TabsTrigger key={m} value={m}>{METHOD_LABELS[m]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative ml-auto w-full max-w-xs">
          <Input
            placeholder="Search patient…"
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
        ) : payments.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No payments recorded{methodFilter !== "ALL" ? " for this method" : " yet"}.
          </p>
        ) : (
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Received by</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium tabular-nums">{p.paymentNo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {format(new Date(p.paidAt), "MMM d, yyyy HH:mm")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">{p.invoice.invoiceNo}</td>
                  <td className="px-4 py-3">
                    <span>{p.invoice.patient.firstName} {p.invoice.patient.lastName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{p.invoice.patient.patientNo}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.refundOfId ? `Refund of ${p.invoice.invoiceNo}` : METHOD_LABELS[p.method] ?? p.method}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${p.amount < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {p.amount < 0 ? "−" : ""}{money(Math.abs(p.amount))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        p.status === "REFUNDED"
                          ? "bg-slate-500/10 text-slate-500 dark:text-slate-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.receivedBy ? `${p.receivedBy.firstName} ${p.receivedBy.lastName}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
