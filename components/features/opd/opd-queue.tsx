"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, ListChecks, Timer, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ConsultationDialog } from "@/components/features/opd/consultation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPatch } from "@/lib/api";

type QueueRow = {
  id: string;
  tokenNo: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
  reason: string | null;
  patient: {
    id: string;
    patientNo: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  doctor: {
    user: { firstName: string; lastName: string; title: string | null };
  } | null;
  department: { name: string } | null;
};

const STATUS_META: Record<string, { label: string; badge: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  PENDING: { label: "Pending", badge: "secondary" },
  CONFIRMED: { label: "Confirmed", badge: "default", className: "bg-primary" },
  COMPLETED: { label: "Completed", badge: "outline" },
  CANCELLED: { label: "Cancelled", badge: "destructive" },
  MISSED: { label: "Missed", badge: "destructive" },
};

const TYPE_LABELS: Record<string, string> = {
  WALKIN: "Walk-in",
  ONLINE: "Online",
  FOLLOWUP: "Follow-up",
};

const todayISO = format(new Date(), "yyyy-MM-dd");

export function OpdQueue() {
  const [day, setDay] = React.useState(todayISO);
  const [consulting, setConsulting] = React.useState<QueueRow | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["opd", day],
    queryFn: () =>
      apiGet<{ items: QueueRow[]; meta: { total: number } }>("/appointments", {
        page: 1,
        pageSize: 200,
        date: day,
      }),
  });

  async function setStatus(id: string, status: string, label: string) {
    try {
      await apiPatch(`/appointments/${id}`, { status });
      toast.success(`Marked ${label.toLowerCase()}`);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function onPrintSlip(a: QueueRow) {
    let qr: string | null = null;
    try {
      const QRCode = (await import("qrcode")).default;
      qr = await QRCode.toDataURL(a.id);
    } catch {
      // QR is optional — the slip still prints without it.
    }
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) return;
    const doc = w.document;
    doc.write(`<!doctype html><html><head><title>OPD Slip — ${a.tokenNo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a}
        .slip{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;max-width:340px;margin:0 auto}
        .head{background:#0E7C6B;color:#fff;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}
        .head h1{font-size:15px;font-weight:700;letter-spacing:-0.01em}
        .head p{font-size:11px;opacity:.85;margin-top:2px}
        .token{background:#fff;color:#0E7C6B;font-family:ui-monospace,monospace;font-weight:800;font-size:13px;padding:6px 10px;border-radius:8px}
        .body{padding:20px}
        .name{font-size:17px;font-weight:700}
        .mono{font-family:ui-monospace,monospace;font-size:12px;color:#64748b;margin-top:2px}
        .line{display:flex;justify-content:space-between;font-size:13px;padding:7px 0;border-bottom:1px dashed #e2e8f0}
        .line:last-child{border-bottom:none}
        .line span{color:#64748b}
        .line b{font-weight:600}
        .qr{display:block;margin:14px auto 0;width:110px;height:110px;border:1px solid #e2e8f0;border-radius:10px;padding:6px}
        .foot{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 20px;font-size:10px;color:#94a3b8}
      </style></head><body><div class="slip">
        <div class="head"><div><h1>City Care Hospital</h1><p>OPD Consultation Slip</p></div><div class="token">${a.tokenNo}</div></div>
        <div class="body">
          <div class="name">${a.patient.firstName} ${a.patient.lastName}</div>
          <div class="mono">${a.patient.patientNo}</div>
          <div style="margin-top:12px">
            <div class="line"><span>Date</span><b>${format(new Date(a.date), "MMM d, yyyy")}</b></div>
            <div class="line"><span>Time</span><b>${a.startTime}${a.endTime ? ` – ${a.endTime}` : ""}</b></div>
            <div class="line"><span>Doctor</span><b>${a.doctor ? `${a.doctor.user.title ? a.doctor.user.title + " " : ""}${a.doctor.user.firstName} ${a.doctor.user.lastName}` : "Unassigned"}</b></div>
            <div class="line"><span>Department</span><b>${a.department?.name ?? "—"}</b></div>
            <div class="line"><span>Type</span><b>${TYPE_LABELS[a.type] ?? a.type}</b></div>
            ${a.reason ? `<div class="line"><span>Reason</span><b>${a.reason}</b></div>` : ""}
          </div>
          ${qr ? `<img class="qr" src="${qr}" alt="QR"/>` : ""}
        </div>
        <div class="foot">Report to the OPD desk 15 minutes before your slot. Carry this slip and your patient ID card.</div>
      </div><script>window.onload=function(){window.print()}</script></body></html>`);
    doc.close();
  }

  const items = data?.items ?? [];
  const counts = {
    waiting: items.filter((a) => a.status === "PENDING").length,
    inConsultation: items.filter((a) => a.status === "CONFIRMED").length,
    done: items.filter((a) => a.status === "COMPLETED").length,
  };

  return (
    <div>
      <PageHeader
        title="OPD Queue"
        description="Tokens, queue and consultation flow for the day"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Waiting" icon={Timer} value={counts.waiting} loading={isLoading} />
        <StatCard label="In consultation" icon={ListChecks} value={counts.inConsultation} loading={isLoading} />
        <StatCard label="Completed" icon={CalendarClock} value={counts.done} loading={isLoading} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="date"
          className="w-auto"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          {items.length} appointment{items.length === 1 ? "" : "s"} ·{" "}
          {format(new Date(day + "T00:00:00"), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      <div className="space-y-3">
        {isLoading ? (          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center">
            <CalendarClock className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">Queue is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No appointments for {format(new Date(day + "T00:00:00"), "MMMM d, yyyy")}.
              Book one from the Appointments page.
            </p>
          </div>
        ) : (
          items.map((a, index) => {
            const meta = STATUS_META[a.status] ?? STATUS_META.PENDING;
            const firstWaiting =
              a.status === "PENDING" && items.filter((x) => x.status === "PENDING")[0]?.id === a.id;
            return (
              <div
                key={a.id}
                className={`flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card p-4 ${
                  firstWaiting ? "ring-1 ring-primary/40" : ""
                }`}
              >
                <div className="w-16 text-center">
                  <p className="text-2xl font-semibold tabular-nums leading-none">
                    {index + 1}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{a.tokenNo}</p>
                </div>
                <div className="min-w-40 leading-tight">
                  <p className="font-medium">
                    {a.patient.firstName} {a.patient.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.patient.patientNo}
                    {a.patient.phone ? ` · ${a.patient.phone}` : ""}
                  </p>
                </div>
                <div className="min-w-40 leading-tight">
                  <p className="text-sm tabular-nums">{a.startTime}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.doctor
                      ? `${a.doctor.user.title ? a.doctor.user.title + " " : ""}${a.doctor.user.firstName} ${a.doctor.user.lastName}`
                      : "Unassigned"}
                  </p>
                </div>
                <Badge className={meta.className} variant={meta.badge}>
                  {meta.label}
                </Badge>
                <div className="ml-auto flex items-center gap-1.5">
                  {a.status === "PENDING" && (
                    <Button size="sm" onClick={() => setStatus(a.id, "CONFIRMED", "In consultation")}>
                      <Loader2 className="size-3.5" /> Call
                    </Button>
                  )}
                  {a.status === "CONFIRMED" && (
                    <>
                      <Button size="sm" onClick={() => setConsulting(a)}>
                        Consult
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(a.id, "COMPLETED", "Completed")}
                      >
                        Complete
                      </Button>
                    </>
                  )}
                  {(a.status === "PENDING" || a.status === "CONFIRMED") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setStatus(a.id, "MISSED", "Missed")}
                    >
                      Missed
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onPrintSlip(a)}>
                    Slip
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConsultationDialog
        open={!!consulting}
        onOpenChange={(open) => {
          if (!open) setConsulting(null);
        }}
        patient={{
          id: consulting?.patient.id ?? "",
          patientNo: consulting?.patient.patientNo ?? "",
          firstName: consulting?.patient.firstName ?? "",
          lastName: consulting?.patient.lastName ?? "",
        }}
        appointmentId={consulting?.id}
        onSaved={() => {
          setConsulting(null);
          refetch();
        }}
      />
    </div>
  );
}
