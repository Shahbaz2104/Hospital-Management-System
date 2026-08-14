"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Beaker,
  FlaskConical,
  Loader2,
  Plus,
  Printer,
  TestTube2,
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
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { LAB_CATEGORIES } from "@/validators/diagnostics";

type PatientOption = { id: string; patientNo: string; firstName: string; lastName: string };
type DoctorOption = {
  id: string;
  user: { firstName: string; lastName: string; title: string | null };
};
type LabTestRow = {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string | null;
  normalRange: string | null;
  price: number;
  description: string | null;
  active: boolean;
};
type LabOrderRow = {
  id: string;
  orderNo: string;
  status: string;
  priority: string;
  tests: string;
  results: string;
  sampleCollectedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  patient: {
    id: string;
    patientNo: string;
    firstName: string;
    lastName: string;
  };
  doctor: {
    user: { firstName: string; lastName: string; title: string | null };
  } | null;
};

const STATUS_META: Record<string, { label: string; badge: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  ORDERED: { label: "Ordered", badge: "secondary" },
  SAMPLE_COLLECTED: { label: "Sample collected", badge: "default", className: "bg-primary" },
  COMPLETED: { label: "Completed", badge: "outline" },
  CANCELLED: { label: "Cancelled", badge: "destructive" },
};

const PRIORITY_STYLE: Record<string, string> = {
  ROUTINE: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  URGENT: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  STAT: "bg-red-100 text-red-800 hover:bg-red-100",
};

const CATEGORY_LABELS: Record<string, string> = {
  HEMATOLOGY: "Hematology",
  BIOCHEMISTRY: "Biochemistry",
  MICROBIOLOGY: "Microbiology",
  URINALYSIS: "Urinalysis",
  IMMUNOLOGY: "Immunology",
};

const orderSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  doctorId: z.string().optional(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  testIds: z.array(z.string()).min(1, "Select at least one test"),
  notes: z.string().trim().optional(),
});

const testSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  code: z.string().trim().min(1, "Code is required").toUpperCase(),
  category: z.enum(LAB_CATEGORIES).default("HEMATOLOGY"),
  unit: z.string().trim().optional(),
  normalRange: z.string().trim().optional(),
  price: z.coerce.number().min(0).default(0),
});

function parseJsonArray<T>(raw: string | null, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

export function LaboratoryPage() {
  const [tab, setTab] = React.useState("orders");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [orderOpen, setOrderOpen] = React.useState(false);
  const [testOpen, setTestOpen] = React.useState(false);
  const [resultsFor, setResultsFor] = React.useState<LabOrderRow | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["lab-orders", statusFilter],
    queryFn: () =>
      apiGet<{ items: LabOrderRow[] }>("/lab-orders", { status: statusFilter }),
  });

  const { data: catalog, refetch: refetchCatalog } = useQuery({
    queryKey: ["lab-tests"],
    queryFn: () => apiGet<{ items: LabTestRow[] }>("/lab-tests"),
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
      priority: "ROUTINE",
      testIds: [],
      notes: "",
    },
  });

  const testForm = useForm<z.input<typeof testSchema>>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      name: "",
      code: "",
      category: "HEMATOLOGY",
      unit: "",
      normalRange: "",
      price: 0,
    },
  });

  async function onCreateOrder(values: z.input<typeof orderSchema>) {
    try {
      await apiPost("/lab-orders", values);
      toast.success("Lab order created");
      setOrderOpen(false);
      orderForm.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  }

  async function onCreateTest(values: z.input<typeof testSchema>) {
    try {
      await apiPost("/lab-tests", values);
      toast.success("Test added to catalog");
      setTestOpen(false);
      testForm.reset();
      refetchCatalog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  }

  async function onStatus(id: string, status: string) {
    try {
      await apiPatch(`/lab-orders/${id}`, { status });
      toast.success("Lab order updated");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function onDelete(id: string, orderNo: string) {
    if (!confirm(`Delete lab order ${orderNo}?`)) return;
    try {
      await apiDelete(`/lab-orders/${id}`);
      toast.success("Lab order deleted");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  function onPrintReport(o: LabOrderRow) {
    const tests = parseJsonArray<{ code: string; name: string; unit: string | null; normalRange: string | null }>(o.tests, []);
    const results = parseJsonArray<{ testId: string; name: string; value: string; unit?: string; normalRange?: string; flag?: string }>(o.results, []);
    const w = window.open("", "_blank", "width=480,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Lab Report — ${o.orderNo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a}
        .sheet{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;max-width:420px;margin:0 auto}
        .head{background:#0f172a;color:#fff;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}
        .head h1{font-size:15px;font-weight:700}
        .head p{font-size:11px;opacity:.85;margin-top:2px}
        .body{padding:20px}
        .name{font-size:17px;font-weight:700}
        .mono{font-family:ui-monospace,monospace;font-size:12px;color:#0E7C6B;font-weight:600;margin-top:2px}
        table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
        th{text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
        td{padding:8px;border-bottom:1px solid #f1f5f9}
        .flag{font-weight:700}
        .high{color:#dc2626}.low{color:#0E7C6B}.normal{color:#2E9E6B}
        .foot{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 20px;font-size:10px;color:#94a3b8}
      </style></head><body><div class="sheet">
        <div class="head"><div><h1>City Care Hospital</h1><p>Laboratory Report</p></div><div style="text-align:right"><b style="font-size:13px">${o.orderNo}</b><p>${o.status === "COMPLETED" ? "Completed" : o.status.toLowerCase()}</p></div></div>
        <div class="body">
          <div class="name">${o.patient.firstName} ${o.patient.lastName}</div>
          <div class="mono">${o.patient.patientNo}</div>
          <table>
            <thead><tr><th>Test</th><th>Result</th><th>Range</th><th>Flag</th></tr></thead>
            <tbody>
              ${results.length > 0
                ? results.map((r) => `<tr><td>${r.name}</td><td>${r.value}${r.unit ? ` ${r.unit}` : ""}</td><td style="color:#64748b">${r.normalRange ?? "—"}</td><td class="flag ${(r.flag ?? "").toLowerCase()}">${r.flag ?? ""}</td></tr>`).join("")
                : tests.map((t) => `<tr><td>${t.name}</td><td colspan="3" style="color:#94a3b8">Pending</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
        <div class="foot">Generated ${format(new Date(), "MMM d, yyyy HH:mm")} · City Care Hospital Laboratory</div>
      </div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  const items = data?.items ?? [];
  const counts = {
    ordered: items.filter((o) => o.status === "ORDERED").length,
    collected: items.filter((o) => o.status === "SAMPLE_COLLECTED").length,
    completed: items.filter((o) => o.status === "COMPLETED").length,
  };

  return (
    <div>
      <PageHeader
        title="Laboratory"
        description="Test catalog, orders, sample collection and results"
      >
        <Button variant="outline" onClick={() => setTestOpen(true)}>
          <Plus className="size-4" /> New test
        </Button>
        <Button onClick={() => setOrderOpen(true)}>
          <Plus className="size-4" /> New lab order
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Ordered" icon={Timer} value={counts.ordered} loading={isLoading} />
        <StatCard label="Samples collected" icon={TestTube2} value={counts.collected} loading={isLoading} />
        <StatCard label="Completed" icon={Beaker} value={counts.completed} loading={isLoading} />
      </div>

      <div className="mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="catalog">Test catalog ({catalog?.items.length ?? 0})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "catalog" ? (
        <div className="rounded-lg border bg-card">
          {catalog?.items.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No tests in the catalog yet. Add one to start ordering.
            </p>
          ) : (
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Test</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Normal range</th>
                  <th className="px-4 py-3 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {catalog?.items.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.name}</p>
                      <p className="tabular-nums text-xs text-muted-foreground">{t.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{CATEGORY_LABELS[t.category] ?? t.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.unit ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground">{t.normalRange ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">${t.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="ALL">All</TabsTrigger>
                <TabsTrigger value="ORDERED">Ordered</TabsTrigger>
                <TabsTrigger value="SAMPLE_COLLECTED">Collected</TabsTrigger>
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
                <FlaskConical className="mx-auto size-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium">No lab orders</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create an order to start the workflow.
                </p>
              </div>
            ) : (
              items.map((o) => {
                const meta = STATUS_META[o.status] ?? STATUS_META.ORDERED;
                const tests = parseJsonArray<{ code: string; name: string }>(o.tests, []);
                const results = parseJsonArray<{ testId: string }>(o.results, []);
                return (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card p-4"
                  >
                    <div className="w-20 text-center">
                      <p className="text-sm font-semibold tabular-nums leading-none">
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
                    <div className="min-w-44 text-sm leading-tight">
                      <p className="line-clamp-1">
                        {tests.map((t) => t.code).join(", ") || "No tests"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {results.length} result{results.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge className={PRIORITY_STYLE[o.priority]} variant="outline">
                      {o.priority}
                    </Badge>
                    <Badge className={meta.className} variant={meta.badge}>
                      {meta.label}
                    </Badge>
                    <div className="ml-auto flex items-center gap-1.5">
                      {o.status === "ORDERED" && (
                        <Button size="sm" onClick={() => onStatus(o.id, "SAMPLE_COLLECTED")}>
                          Collect sample
                        </Button>
                      )}
                      {o.status === "SAMPLE_COLLECTED" && (
                        <Button size="sm" onClick={() => setResultsFor(o)}>
                          Enter results
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => onPrintReport(o)}>
                        <Printer className="size-3.5" /> Report
                      </Button>
                      {(o.status === "ORDERED" || o.status === "SAMPLE_COLLECTED") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete lab order"
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
        </>
      )}

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New lab order</DialogTitle>
            <DialogDescription>Assign one or more tests to a patient.</DialogDescription>
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
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ROUTINE">Routine</SelectItem>
                            <SelectItem value="URGENT">Urgent</SelectItem>
                            <SelectItem value="STAT">STAT</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={orderForm.control}
                name="testIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tests</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value[0] ?? ""}
                        onValueChange={(v) => {
                          if (v && !field.value.includes(v)) {
                            field.onChange([...field.value, v]);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Add tests…" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalog?.items.map((t) => (
                            <SelectItem key={t.id} value={t.id} disabled={field.value.includes(t.id)}>
                              {t.name} ({t.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {field.value.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {field.value.map((id) => {
                          const t = catalog?.items.find((x) => x.id === id);
                          if (!t) return null;
                          return (
                            <Badge
                              key={id}
                              variant="secondary"
                              className="cursor-pointer"
                              onClick={() =>
                                field.onChange(field.value.filter((x) => x !== id))
                              }
                            >
                              {t.code} ✕
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
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

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add test to catalog</DialogTitle>
            <DialogDescription>Define the test parameters.</DialogDescription>
          </DialogHeader>
          <Form {...testForm}>
            <form onSubmit={testForm.handleSubmit(onCreateTest)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={testForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Complete blood count" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={testForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="CBC" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={testForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={testForm.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="mg/dL" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={testForm.control}
                  name="normalRange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Normal range</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="70–110" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={testForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTestOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={testForm.formState.isSubmitting}>
                  {testForm.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Add test
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ResultsDialog
        order={resultsFor}
        onClose={() => setResultsFor(null)}
        onSaved={() => {
          setResultsFor(null);
          refetch();
        }}
      />
    </div>
  );
}

function ResultsDialog({
  order,
  onClose,
  onSaved,
}: {
  order: LabOrderRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const tests = order
    ? parseJsonArray<{ testId: string; name: string; unit: string | null; normalRange: string | null }>(order.tests, [])
    : [];

  React.useEffect(() => {
    if (order) {
      const initial: Record<string, string> = {};
      for (const t of tests) initial[t.testId] = "";
      setValues(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  if (!order) return null;

  const onSave = async () => {
    const results = tests.map((t) => ({
      testId: t.testId,
      name: t.name,
      value: values[t.testId] ?? "",
      unit: t.unit ?? "",
      normalRange: t.normalRange ?? "",
      flag: (() => {
        const v = values[t.testId] ?? "";
        if (!v || !t.normalRange) return undefined;
        const num = Number(v);
        const match = t.normalRange.match(/([\d.]+)\s*[–-]\s*([\d.]+)/);
        if (!match || Number.isNaN(num)) return undefined;
        const [lo, hi] = [Number(match[1]), Number(match[2])];
        if (num > hi) return "HIGH";
        if (num < lo) return "LOW";
        return "NORMAL";
      })(),
    }));

    setSaving(true);
    try {
      await apiPatch(`/lab-orders/${order.id}`, { results });
      toast.success("Results submitted");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter results</DialogTitle>
          <DialogDescription>
            {order.patient.firstName} {order.patient.lastName} · {order.orderNo}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {tests.map((t) => (
            <div key={t.testId} className="grid grid-cols-3 items-center gap-2">
              <div className="leading-tight">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="tabular-nums text-[11px] text-muted-foreground">
                  {t.normalRange ?? "—"}
                </p>
              </div>
              <Input
                className="col-span-2"
                placeholder={t.unit ? `Value (${t.unit})` : "Value"}
                value={values[t.testId] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [t.testId]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Submit results
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
