"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Download, Loader2, Play, Search, Wallet } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPost } from "@/lib/api";

type PayrollRecord = {
  id: string;
  month: string;
  basicSalary: number;
  allowances: number;
  bonus: number;
  overtime: number;
  deductions: number;
  netPay: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  employee: {
    employeeNo: string;
    user: { firstName: string; lastName: string };
    department: { name: string } | null;
  };
};

type PayrollStats = {
  total: number;
  paid: number;
  pending: number;
  amountTotal: number;
  amountPaid: number;
  amountPending: number;
};

const money = (n: number) => `$${n.toFixed(2)}`;

export function PayrollPage() {
  const [month, setMonth] = React.useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = React.useState("ALL");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [generating, setGenerating] = React.useState(false);
  const [paying, setPaying] = React.useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["payroll", month],
    queryFn: () => apiGet<{ items: PayrollRecord[] }>("/hr/payroll", { month }),
  });
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["payroll-stats", month],
    queryFn: () => apiGet<PayrollStats>("/hr/payroll/stats", { month }),
  });

  const records = data?.items ?? [];

  const filtered = records.filter(
    (p) =>
      (status === "ALL" || p.status === status) &&
      (search === "" ||
        `${p.employee.user.firstName} ${p.employee.user.lastName} ${p.employee.employeeNo}`
          .toLowerCase()
          .includes(search.toLowerCase()))
  );

  React.useEffect(() => {
    setSelected(new Set());
  }, [month, records.length]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["payroll", month] });
    queryClient.invalidateQueries({ queryKey: ["payroll-stats", month] });
  }

  async function generate() {
    if (!month) return;
    setGenerating(true);
    try {
      const result = await apiPost<{ created: number; skipped: number }>("/hr/payroll", { month });
      toast.success(
        result.created > 0
          ? `Generated ${result.created} payslip${result.created === 1 ? "" : "s"} for ${month}`
          : result.skipped > 0
            ? `Already generated for ${month} (${result.skipped} employees)`
            : "No active employees to pay"
      );
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate payroll");
    } finally {
      setGenerating(false);
    }
  }

  async function markPaid() {
    const ids = [...selected];
    if (!ids.length) return;
    setPaying(true);
    try {
      const result = await apiPost<{ count: number }>("/hr/payroll/mark-paid", { ids });
      toast.success(`Marked ${result.count} payslip${result.count === 1 ? "" : "s"} as paid`);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark paid");
    } finally {
      setPaying(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  return (
    <div>
      <PageHeader title="Payroll" description="Monthly payroll runs and payslips" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Net payout · ${month}`} icon={Wallet} value={money(stats?.amountTotal ?? 0)} loading={loadingStats} />
        <StatCard label="Paid" icon={CheckCircle2} value={money(stats?.amountPaid ?? 0)} loading={loadingStats} />
        <StatCard label="Pending" icon={Banknote} value={money(stats?.amountPending ?? 0)} loading={loadingStats} />
        <StatCard label="Slips" icon={Download} value={stats?.total ?? 0} loading={loadingStats} />
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-40" />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-9 w-48 pl-8" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="GENERATED">Generated</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={markPaid} disabled={paying || selected.size === 0}>
              {paying && <Loader2 className="size-4 animate-spin" />}
              Mark paid ({selected.size})
            </Button>
            <Button size="sm" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Generate for {month}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
          </div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No payroll run for {month}. Click “Generate for {month}” to create payslips for all active employees.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No matching payroll records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={allChecked}
                      onChange={() => {
                        const next = new Set(selected);
                        if (allChecked) filtered.forEach((p) => next.delete(p.id));
                        else filtered.forEach((p) => next.add(p.id));
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th className="text-right">Basic</th>
                  <th className="text-right">Allowances</th>
                  <th className="text-right">Bonus</th>
                  <th className="text-right">Deductions</th>
                  <th className="text-right">Net pay</th>
                  <th>Status</th>
                  <th className="text-right">Payslip</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={selected.has(p.id) ? "bg-primary/5" : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                      />
                    </td>
                    <td>
                      <p className="font-medium">{p.employee.user.firstName} {p.employee.user.lastName}</p>
                      <p className="tabular-nums text-xs text-muted-foreground">{p.employee.employeeNo}</p>
                    </td>
                    <td>{p.employee.department?.name ?? "—"}</td>
                    <td className="text-right tabular-nums">{money(p.basicSalary)}</td>
                    <td className="text-right tabular-nums">{money(p.allowances)}</td>
                    <td className="text-right tabular-nums">{money(p.bonus)}</td>
                    <td className="text-right tabular-nums text-destructive">{money(p.deductions)}</td>
                    <td className="text-right font-semibold tabular-nums">{money(p.netPay)}</td>
                    <td>
                      {p.status === "PAID" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Paid</Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">Generated</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => window.open(`/api/hr/payroll/${p.id}/payslip`, "_blank")}>
                        <Download className="size-4" /> PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          Showing {filtered.length} of {records.length} payslips for {month}
        </div>
      </div>
    </div>
  );
}
