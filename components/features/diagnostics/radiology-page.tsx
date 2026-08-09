"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  CalendarClock,
  Loader2,
  Microscope,
  Plus,
  Printer,
  ScanLine,
  Timer,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { RAD_MODALITIES } from "@/validators/diagnostics";

type PatientOption = { id: string; patientNo: string; firstName: string; lastName: string };
type DoctorOption = {
  id: string;
  user: { firstName: string; lastName: string; title: string | null };
};
type RadiologyOrderRow = {
  id: string;
  orderNo: string;
  status: string;
  modality: string;
  bodyPart: string | null;
  scheduledAt: string | null;
  findings: string | null;
  reports: string | null;
  notes: string | null;
  createdAt: string;
  patient: {
    id: string;
    patientNo: string;
    firstName: string;
    lastName: string;
    gender: string;
    dob: string;
  };
  doctor: {
    user: { firstName: string; lastName: string; title: string | null };
  } | null;
};

const STATUS_META: Record<string, { label: string; badge: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  ORDERED: { label: "Ordered", badge: "secondary" },
  SCHEDULED: { label: "Scheduled", badge: "default", className: "bg-primary" },
  COMPLETED: { label: "Completed", badge: "outline" },
  CANCELLED: { label: "Cancelled", badge: "destructive" },
};

const MODALITY_LABELS: Record<string, string> = {
  XRAY: "X-Ray",
  MRI: "MRI",
  CT: "CT Scan",
  ULTRASOUND: "Ultrasound",
};

const orderSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  doctorId: z.string().optional(),
  modality: z.enum(RAD_MODALITIES).default("XRAY"),
  bodyPart: z.string().trim().optional(),
  scheduledAt: z.string().optional(),
  notes: z.string().trim().optional(),
});

const reportSchema = z.object({
  findings: z.string().trim().min(1, "Findings are required"),
});

type ReportLine = { name: string; url: string };

export function RadiologyPage() {
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [orderOpen, setOrderOpen] = React.useState(false);
  const [reportFor, setReportFor] = React.useState<RadiologyOrderRow | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["radiology-orders", statusFilter],
    queryFn: () =>
      apiGet<{ items: RadiologyOrderRow[] }>("/radiology-orders", { status: statusFilter }),
  });

  const { data: patients } = useQuery({
    queryKey: ["patients", "options"],
    queryFn: () =>
      apiGet<{ items: PatientOption[] }>("/patients", { page: 1, pageSize: 100 }),
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors", "options"],
    queryFn: () =>
      apiGet<{ items: DoctorOption[] }>("/doctors", { page: 1, pageSize: 100 }),
  });

  const orderForm = useForm<z.input<typeof orderSchema>>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      patientId: "",
      doctorId: "",
      modality: "XRAY",
      bodyPart: "",
      scheduledAt: "",
      notes: "",
    },
  });

  async function onCreateOrder(values: z.input<typeof orderSchema>) {
    try {
      await apiPost("/radiology-orders", {
        ...values,
        scheduledAt: values.scheduledAt
          ? new Date(values.scheduledAt).toISOString()
          : undefined,
      });
      toast.success("Radiology order created");
      setOrderOpen(false);
      orderForm.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  }

  async function onStatus(id: string, status: string) {
    try {
      await apiPatch(`/radiology-orders/${id}`, { status });
      toast.success("Radiology order updated");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function onDelete(id: string, orderNo: string) {
    if (!confirm(`Delete radiology order ${orderNo}?`)) return;
    try {
      await apiDelete(`/radiology-orders/${id}`);
      toast.success("Radiology order deleted");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  function onPrintReport(o: RadiologyOrderRow) {
    const reports = parseJsonArray<{ name: string; url: string; uploadedAt: string }>(o.reports, []);
    const w = window.open("", "_blank", "width=480,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Radiology Report — ${o.orderNo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a}
        .sheet{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;max-width:420px;margin:0 auto}
        .head{background:#0f172a;color:#fff;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}
        .head h1{font-size:15px;font-weight:700}
        .head p{font-size:11px;opacity:.85;margin-top:2px}
        .body{padding:20px}
        .name{font-size:17px;font-weight:700}
        .mono{font-family:ui-monospace,monospace;font-size:12px;color:#2563eb;font-weight:600;margin-top:2px}
        .meta{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}
        .meta b{color:#64748b;font-weight:600;display:block;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
        .section{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin:16px 0 6px}
        .findings{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:13px;line-height:1.6;white-space:pre-wrap}
        .link{display:block;font-size:12px;color:#2563eb;margin-top:4px}
        .foot{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 20px;font-size:10px;color:#94a3b8}
      </style></head><body><div class="sheet">
        <div class="head"><div><h1>City Care Hospital</h1><p>Radiology Report</p></div><div style="text-align:right"><b style="font-size:13px">${o.orderNo}</b><p>${MODALITY_LABELS[o.modality] ?? o.modality}</p></div></div>
        <div class="body">
          <div class="name">${o.patient.firstName} ${o.patient.lastName}</div>
          <div class="mono">${o.patient.patientNo}</div>
          <div class="meta">
            <div><b>Study</b>${MODALITY_LABELS[o.modality] ?? o.modality}</div>
            <div><b>Body part</b>${o.bodyPart ?? "—"}</div>
            ${o.scheduledAt ? `<div><b>Performed</b>${format(new Date(o.scheduledAt), "MMM d, yyyy")}</div>` : ""}
            <div><b>Reported</b>${o.findings ? format(new Date(), "MMM d, yyyy") : "—"}</div>
          </div>
          <p class="section">Findings</p>
          <div class="findings">${o.findings ?? "Pending radiologist interpretation."}</div>
          ${reports.length > 0 ? `<p class="section">Attachments</p>${reports.map((r) => `<a class="link" href="${r.url}" target="_blank">${r.name}</a>`).join("")}` : ""}
        </div>
        <div class="foot">Generated ${format(new Date(), "MMM d, yyyy HH:mm")} · City Care Hospital Radiology</div>
      </div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  const items = data?.items ?? [];
  const counts = {
    ordered: items.filter((o) => o.status === "ORDERED").length,
    scheduled: items.filter((o) => o.status === "SCHEDULED").length,
    completed: items.filter((o) => o.status === "COMPLETED").length,
  };

  return (
    <div>
      <PageHeader
        title="Radiology"
        description="Imaging orders, scheduling and reports"
      >
        <Button onClick={() => setOrderOpen(true)}>
          <Plus className="size-4" /> New radiology order
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Ordered" icon={Timer} value={counts.ordered} loading={isLoading} />
        <StatCard label="Scheduled" icon={CalendarClock} value={counts.scheduled} loading={isLoading} />
        <StatCard label="Completed" icon={ScanLine} value={counts.completed} loading={isLoading} />
      </div>

      <div className="mb-4">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="ORDERED">Ordered</TabsTrigger>
            <TabsTrigger value="SCHEDULED">Scheduled</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
            <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center">
            <Microscope className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">No radiology orders</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an order to start the imaging workflow.
            </p>
          </div>
        ) : (
          items.map((o) => {
            const meta = STATUS_META[o.status] ?? STATUS_META.ORDERED;
            return (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card p-4"
              >
                <div className="w-20 text-center">
                  <p className="font-mono text-sm font-semibold tabular-nums leading-none">
                    {o.orderNo}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {format(new Date(o.createdAt), "MMM d")}
                  </p>
                </div>
                <div className="min-w-40 leading-tight">
                  <p className="font-medium">
                    {o.patient.firstName} {o.patient.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{o.patient.patientNo}</p>
                </div>
                <div className="min-w-40 text-sm leading-tight">
                  <p className="font-medium">{MODALITY_LABELS[o.modality] ?? o.modality}</p>
                  <p className="text-xs text-muted-foreground">{o.bodyPart ?? "—"}</p>
                </div>
                <Badge className={meta.className} variant={meta.badge}>
                  {meta.label}
                </Badge>
                <div className="ml-auto flex items-center gap-1.5">
                  {o.status === "ORDERED" && (
                    <Button size="sm" onClick={() => onStatus(o.id, "SCHEDULED")}>
                      Schedule
                    </Button>
                  )}
                  {o.status === "SCHEDULED" && (
                    <Button size="sm" onClick={() => setReportFor(o)}>
                      Enter report
                    </Button>
                  )}
                  {o.status === "COMPLETED" && (
                    <Button size="sm" variant="outline" onClick={() => onPrintReport(o)}>
                      <Printer className="size-3.5" /> Report
                    </Button>
                  )}
                  {(o.status === "ORDERED" || o.status === "SCHEDULED") && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete radiology order"
                      onClick={() => onDelete(o.id, o.orderNo)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New radiology order</DialogTitle>
            <DialogDescription>Request an imaging study for a patient.</DialogDescription>
          </DialogHeader>
          <Form {...orderForm}>
            <form onSubmit={orderForm.handleSubmit(onCreateOrder)} className="space-y-4">
              <FormField
                control={orderForm.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Search patient" />
                        </SelectTrigger>
                        <SelectContent>
                          {patients?.items.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.firstName} {p.lastName} · {p.patientNo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={orderForm.control}
                  name="doctorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doctor</FormLabel>
                      <FormControl>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Ordering doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            {doctors?.items.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.user.title ? `${d.user.title} ` : ""}
                                {d.user.firstName} {d.user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={orderForm.control}
                  name="modality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modality</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RAD_MODALITIES.map((m) => (
                              <SelectItem key={m} value={m}>
                                {MODALITY_LABELS[m]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={orderForm.control}
                  name="bodyPart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body part</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Chest, Abdomen, Left knee…" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={orderForm.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule for</FormLabel>
                      <FormControl>
                        <Input {...field} type="datetime-local" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={orderForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Clinical notes (optional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOrderOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={orderForm.formState.isSubmitting}>
                  {orderForm.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Create order
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ReportDialog
        order={reportFor}
        onClose={() => setReportFor(null)}
        onSaved={() => {
          setReportFor(null);
          refetch();
        }}
      />
    </div>
  );
}

function parseJsonArray<T>(raw: string | null, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

function ReportDialog({
  order,
  onClose,
  onSaved,
}: {
  order: RadiologyOrderRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [findings, setFindings] = React.useState("");
  const [lines, setLines] = React.useState<ReportLine[]>([{ name: "", url: "" }]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (order) {
      setFindings(order.findings ?? "");
      const existing = parseJsonArray<{ name: string; url: string }>(order.reports, []);
      setLines(existing.length > 0 ? existing : [{ name: "", url: "" }]);
    }
  }, [order]);

  if (!order) return null;

  const onSave = async () => {
    const reportForm = reportSchema.safeParse({ findings });
    if (!reportForm.success) {
      toast.error(reportForm.error.errors[0]?.message ?? "Findings are required");
      return;
    }
    const reports = lines
      .filter((l) => l.name.trim() && l.url.trim())
      .map((l) => ({ name: l.name.trim(), url: l.url.trim() }));

    setSaving(true);
    try {
      await apiPatch(`/radiology-orders/${order.id}`, {
        findings: reportForm.data.findings,
        reports,
      });
      toast.success("Report submitted");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Radiology report</DialogTitle>
          <DialogDescription>
            {order.patient.firstName} {order.patient.lastName} · {order.orderNo}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <FormLabel>Findings</FormLabel>
            <Textarea
              className="mt-1.5"
              rows={6}
              placeholder="Imaging findings and impression…"
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <FormLabel>Attachments</FormLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLines((l) => [...l, { name: "", url: "" }])}
              >
                <Plus className="size-3.5" /> Add file
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="File name"
                    value={line.name}
                    onChange={(e) =>
                      setLines((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Image URL"
                      value={line.url}
                      onChange={(e) =>
                        setLines((l) => l.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remove report line"
                      disabled={lines.length === 1}
                      onClick={() => setLines((l) => l.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
