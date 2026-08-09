"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { Printer, RotateCcw } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";

type DischargeRow = {
  id: string;
  admissionNo: string;
  status: string;
  reason: string | null;
  diagnosis: string | null;
  admittedAt: string;
  dischargeAt: string | null;
  patient: {
    patientNo: string;
    firstName: string;
    lastName: string;
  };
  bed: {
    number: string;
    room: { number: string; type: string };
  } | null;
};

export function DischargesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["discharges"],
    queryFn: () => apiGet<{ items: DischargeRow[] }>("/admissions"),
  });

  async function onPrintSummary(a: DischargeRow) {
    if (!a.dischargeAt) return;
    const days = differenceInCalendarDays(new Date(a.dischargeAt), new Date(a.admittedAt));
    const w = window.open("", "_blank", "width=440,height=680");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Discharge Summary — ${a.admissionNo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a}
        .sheet{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;max-width:380px;margin:0 auto}
        .head{background:#0f172a;color:#fff;padding:18px 20px}
        .head h1{font-size:15px;font-weight:700}
        .head p{font-size:11px;opacity:.85;margin-top:2px}
        .body{padding:20px}
        .name{font-size:17px;font-weight:700}
        .mono{font-family:ui-monospace,monospace;font-size:12px;color:#0E7C6B;font-weight:600;margin-top:2px}
        .line{display:flex;justify-content:space-between;font-size:13px;padding:7px 0;border-bottom:1px dashed #e2e8f0}
        .line:last-child{border-bottom:none}
        .line span{color:#64748b}
        .line b{font-weight:600}
        .foot{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 20px;font-size:10px;color:#94a3b8}
      </style></head><body><div class="sheet">
        <div class="head"><h1>City Care Hospital</h1><p>In-patient Discharge Summary</p></div>
        <div class="body">
          <div class="name">${a.patient.firstName} ${a.patient.lastName}</div>
          <div class="mono">${a.patient.patientNo} · ${a.admissionNo}</div>
          <div style="margin-top:12px">
            <div class="line"><span>Admitted</span><b>${format(new Date(a.admittedAt), "MMM d, yyyy HH:mm")}</b></div>
            <div class="line"><span>Discharged</span><b>${format(new Date(a.dischargeAt), "MMM d, yyyy HH:mm")}</b></div>
            <div class="line"><span>Length of stay</span><b>${days} day${days === 1 ? "" : "s"}</b></div>
            <div class="line"><span>Bed</span><b>${a.bed ? `${a.bed.number} (${a.bed.room.type})` : "—"}</b></div>
            ${a.diagnosis ? `<div class="line"><span>Diagnosis</span><b>${a.diagnosis}</b></div>` : ""}
            ${a.reason ? `<div class="line"><span>Reason</span><b>${a.reason}</b></div>` : ""}
          </div>
        </div>
        <div class="foot">Follow-up visit advised within 2 weeks. Contact OPD for appointments.</div>
      </div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  const items = data?.items ?? [];
  const discharged = items.filter((a) => a.status === "DISCHARGED");
  const avgDays = discharged.length
    ? discharged.reduce((s, a) => {
        if (!a.dischargeAt) return s;
        return s + differenceInCalendarDays(new Date(a.dischargeAt), new Date(a.admittedAt));
      }, 0) / discharged.length
    : 0;

  return (
    <div>
      <PageHeader
        title="Discharges"
        description="Completed IPD stays and discharge summaries"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Discharged" icon={RotateCcw} value={discharged.length} loading={isLoading} />
        <StatCard
          label="Avg. stay"
          icon={RotateCcw}
          value={avgDays ? `${avgDays.toFixed(1)} days` : "—"}
          loading={isLoading}
        />
        <StatCard label="Total admissions" icon={RotateCcw} value={items.length} loading={isLoading} />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : discharged.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center">
            <RotateCcw className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">No discharges yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Discharged admissions appear here with their stay summary.
            </p>
          </div>
        ) : (
          discharged.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card p-4"
            >
              <div className="w-20 text-center">
                <p className="text-sm font-semibold font-mono tabular-nums leading-none">
                  {a.admissionNo}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {a.dischargeAt ? format(new Date(a.dischargeAt), "MMM d, yyyy") : ""}
                </p>
              </div>
              <div className="min-w-40 leading-tight">
                <p className="font-medium">
                  {a.patient.firstName} {a.patient.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{a.patient.patientNo}</p>
              </div>
              <div className="min-w-36 text-sm leading-tight">
                <p>
                  {a.dischargeAt && a.admittedAt
                    ? differenceInCalendarDays(new Date(a.dischargeAt), new Date(a.admittedAt))
                    : 0}{" "}
                  days stay
                </p>
                <p className="text-xs text-muted-foreground">{a.bed?.number ?? "No bed"}</p>
              </div>
              <Badge variant="outline">Discharged</Badge>
              <div className="ml-auto">
                <Button size="sm" variant="outline" onClick={() => onPrintSummary(a)}>
                  <Printer className="size-3.5" /> Summary
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
