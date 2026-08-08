"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Printer, RefreshCcw } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";

type ReportResult = {
  type: string;
  title: string;
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number | null>[];
  summary: { label: string; value: string | number }[];
};

const TABS: { value: string; label: string }[] = [
  { value: "patients", label: "Patients" },
  { value: "revenue", label: "Revenue" },
  { value: "doctors", label: "Doctors" },
  { value: "appointments", label: "Appointments" },
  { value: "medicines", label: "Medicines" },
  { value: "inventory", label: "Inventory" },
  { value: "admissions", label: "Admissions" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const [type, setType] = React.useState("patients");
  const [from, setFrom] = React.useState(monthAgoISO());
  const [to, setTo] = React.useState(todayISO());

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["report", type, from, to],
    queryFn: () =>
      apiGet<ReportResult>("/reports", {
        type,
        from,
        to,
      }),
  });

  async function exportReport(format: "pdf" | "excel") {
    const url = `/api/reports/export?type=${type}&format=${format}&from=${from}&to=${to}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Export failed");
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${type}-report-${todayISO()}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  }

  function printReport() {
    const win = window.open("", "_blank", "width=1000,height=700");
    if (!win || !data) return;
    const rows = data.rows
      .map(
        (row) =>
          `<tr>${data.columns
            .map(
              (c) =>
                `<td style="text-align:${c.align === "right" ? "right" : "left"}; padding:6px 10px; border:1px solid #ddd; font-size:12px;">${String(row[c.key] ?? "—")}</td>`
            )
            .join("")}</tr>`
      )
      .join("");
    win.document.write(`<!doctype html><html><head><title>${data.title}</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#f1f5f9;text-align:left;padding:6px 10px;border:1px solid #ddd;font-size:12px}.meta{color:#555;font-size:12px}</style>
      </head><body><h1>${data.title}</h1>
      <p class="meta">Range: ${from} → ${to} · Generated ${new Date().toLocaleString()}</p>
      ${data.summary.map((s) => `<p class="meta"><strong>${s.label}:</strong> ${s.value}</p>`).join("")}
      <table><thead><tr>${data.columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div>
      <PageHeader title="Reports" description="Operational and financial reports" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Tabs value={type} onValueChange={setType}>
          <TabsList className="flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : data ? (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.summary.slice(0, 4).map((s) => (
              <StatCard key={s.label} label={s.label} icon={FileText} value={s.value} />
            ))}
          </div>
          {data.summary.length > 4 && (
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.summary.slice(4).map((s) => (
                <div key={s.label} className="flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">
                {data.title}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {from} → {to} · {data.rows.length} rows
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
                  <RefreshCcw className="size-3.5" /> Refresh
                </Button>
                <Button size="sm" variant="outline" onClick={printReport} disabled={data.rows.length === 0}>
                  <Printer className="size-3.5" /> Print
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportReport("excel")}>
                  <FileSpreadsheet className="size-3.5" /> Excel
                </Button>
                <Button size="sm" onClick={() => exportReport("pdf")}>
                  <FileText className="size-3.5" /> PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.rows.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No data for the selected range.</p>
              ) : (
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      {data.columns.map((c) => (
                        <th key={c.key} className={c.align === "right" ? "text-right" : "text-left"}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i}>
                        {data.columns.map((c) => (
                          <td key={c.key} className={c.align === "right" ? "text-right tabular-nums" : "text-left"}>
                            {String(row[c.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
