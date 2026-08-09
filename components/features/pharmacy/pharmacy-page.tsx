"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  Package,
  Pill,
  Plus,
  Printer,
  ShoppingCart,
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
import { MEDICINE_CATEGORIES } from "@/validators/pharmacy";

type PatientOption = { id: string; patientNo: string; firstName: string; lastName: string };
type MedicineRow = {
  id: string;
  name: string;
  genericName: string | null;
  category: string;
  manufacturer: string | null;
  unit: string;
  packSize: number;
  price: number;
  cost: number;
  stock: number;
  reorderLevel: number;
  expiryDate: string | null;
  storage: string | null;
  barcode: string | null;
  description: string | null;
  stockStatus: string;
  expiryStatus: string | null;
};
type SupplierRow = { id: string; name: string; contactPerson: string | null; phone: string | null };
type SaleRow = {
  id: string;
  saleNo: string;
  items: string;
  total: number;
  notes: string | null;
  createdAt: string;
  patient: { id: string; patientNo: string; firstName: string; lastName: string };
};
type PurchaseOrderRow = {
  id: string;
  poNo: string;
  items: string;
  total: number;
  status: string;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string; contactPerson: string | null };
};

const CATEGORY_LABELS: Record<string, string> = {
  ANALGESIC: "Analgesic",
  ANTIBIOTIC: "Antibiotic",
  ANTIPYRETIC: "Antipyretic",
  ANTACID: "Antacid",
  VITAMIN: "Vitamin",
  ANTIALLERGIC: "Antiallergic",
  CARDIAC: "Cardiac",
  DIABETIC: "Diabetic",
  RESPIRATORY: "Respiratory",
  GENERAL: "General",
};

const medicineSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  genericName: z.string().trim().optional(),
  category: z.enum(MEDICINE_CATEGORIES).default("GENERAL"),
  manufacturer: z.string().trim().optional(),
  unit: z.string().trim().min(1, "Unit is required").default("tablet"),
  packSize: z.coerce.number().int().min(1).default(1),
  price: z.coerce.number().min(0).default(0),
  cost: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(10),
  expiryDate: z.string().optional(),
  storage: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
});

type SaleLine = { medicineId: string; quantity: number };
type PoLine = { medicineId: string; quantity: number; unitCost: number };

function parseJsonArray<T>(raw: string | null, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

export function PharmacyPage() {
  const [tab, setTab] = React.useState("medicines");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [poFilter, setPoFilter] = React.useState("ALL");
  const [medicineOpen, setMedicineOpen] = React.useState(false);
  const [saleOpen, setSaleOpen] = React.useState(false);
  const [poOpen, setPoOpen] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["medicines", categoryFilter],
    queryFn: () =>
      apiGet<{ items: MedicineRow[] }>("/medicines", { category: categoryFilter }),
  });

  const { data: salesData, refetch: refetchSales } = useQuery({
    queryKey: ["pharmacy-sales"],
    queryFn: () => apiGet<{ items: SaleRow[] }>("/pharmacy/sales"),
  });

  const { data: poData, refetch: refetchPo } = useQuery({
    queryKey: ["purchase-orders", poFilter],
    queryFn: () =>
      apiGet<{ items: PurchaseOrderRow[] }>("/purchase-orders", { status: poFilter }),
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", "active"],
    queryFn: () => apiGet<{ items: SupplierRow[] }>("/suppliers", { active: "true" }),
  });

  const { data: patients } = useQuery({
    queryKey: ["patients", "options"],
    queryFn: () =>
      apiGet<{ items: PatientOption[] }>("/patients", { page: 1, pageSize: 100 }),
  });

  const medicineForm = useForm<z.input<typeof medicineSchema>>({
    resolver: zodResolver(medicineSchema),
    defaultValues: {
      name: "",
      genericName: "",
      category: "GENERAL",
      manufacturer: "",
      unit: "tablet",
      packSize: 1,
      price: 0,
      cost: 0,
      stock: 0,
      reorderLevel: 10,
      expiryDate: "",
      storage: "",
      barcode: "",
    },
  });

  async function onCreateMedicine(values: z.input<typeof medicineSchema>) {
    try {
      await apiPost("/medicines", {
        ...values,
        expiryDate: values.expiryDate
          ? new Date(values.expiryDate).toISOString()
          : undefined,
      });
      toast.success("Medicine added");
      setMedicineOpen(false);
      medicineForm.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  }

  async function onDeleteMedicine(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await apiDelete(`/medicines/${id}`);
      toast.success("Medicine deleted");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  function onPrintReceipt(sale: SaleRow) {
    const items = parseJsonArray<{ name: string; quantity: number; unitPrice: number }>(sale.items, []);
    const w = window.open("", "_blank", "width=380,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Receipt — ${sale.saleNo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a}
        .sheet{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;max-width:340px;margin:0 auto}
        .head{background:#0f172a;color:#fff;padding:16px 20px;text-align:center}
        .head h1{font-size:14px;font-weight:700}
        .head p{font-size:11px;opacity:.85;margin-top:2px}
        .body{padding:18px 20px}
        .row{display:flex;justify-content:space-between;font-size:12px;color:#64748b;padding:3px 0}
        .total{margin-top:12px;padding-top:10px;border-top:2px dashed #e2e8f0;display:flex;justify-content:space-between;font-weight:700;font-size:14px}
        table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
        th{text-align:left;padding:6px 0;border-bottom:2px solid #e2e8f0;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
        td{padding:6px 0;border-bottom:1px solid #f1f5f9}
        .mono{font-family:ui-monospace,monospace;font-size:11px;color:#0E7C6B;font-weight:600}
        .foot{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 20px;font-size:10px;color:#94a3b8;text-align:center}
      </style></head><body><div class="sheet">
        <div class="head"><h1>City Care Hospital</h1><p>Pharmacy Receipt</p></div>
        <div class="body">
          <div class="row"><span>Receipt</span><span class="mono">${sale.saleNo}</span></div>
          <div class="row"><span>Patient</span><span>${sale.patient.firstName} ${sale.patient.lastName}</span></div>
          <div class="row"><span>Date</span><span>${format(new Date(sale.createdAt), "MMM d, yyyy HH:mm")}</span></div>
          <table>
            <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Amt</th></tr></thead>
            <tbody>
              ${items.map((i) => `<tr><td>${i.name}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">$${(i.quantity * i.unitPrice).toFixed(2)}</td></tr>`).join("")}
            </tbody>
          </table>
          <div class="total"><span>Total</span><span>$${sale.total.toFixed(2)}</span></div>
        </div>
        <div class="foot">Thank you — City Care Hospital Pharmacy</div>
      </div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  const medicines = data?.items ?? [];
  const lowStock = medicines.filter((m) => m.stockStatus === "LOW");
  const expiring = medicines.filter((m) => m.expiryStatus === "EXPIRING" || m.expiryStatus === "EXPIRED");

  return (
    <div>
      <PageHeader
        title="Pharmacy"
        description="Medicines, dispensing and purchase orders"
      >
        <Button variant="outline" onClick={() => setPoOpen(true)}>
          <ShoppingCart className="size-4" /> New PO
        </Button>
        <Button variant="outline" onClick={() => setMedicineOpen(true)}>
          <Plus className="size-4" /> New medicine
        </Button>
        <Button onClick={() => setSaleOpen(true)}>
          <Pill className="size-4" /> Dispense
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Low stock items" icon={AlertTriangle} value={lowStock.length} loading={isLoading} />
        <StatCard label="Expiring / expired" icon={CalendarClock} value={expiring.length} loading={isLoading} />
        <StatCard label="Recent sales" icon={Pill} value={salesData?.items.length ?? 0} loading={isLoading} />
      </div>

      <div className="mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="medicines">Medicines</TabsTrigger>
            <TabsTrigger value="sales">Sales ({salesData?.items.length ?? 0})</TabsTrigger>
            <TabsTrigger value="purchase">Purchase orders</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "medicines" && (
        <>
          <div className="mb-4">
            <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
              <TabsList className="flex-wrap">
                <TabsTrigger value="ALL">All</TabsTrigger>
                {MEDICINE_CATEGORIES.map((c) => (
                  <TabsTrigger key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="rounded-lg border bg-card">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : medicines.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                No medicines in this category yet.
              </p>
            ) : (
              <table className="data-table w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Medicine</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{m.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {m.barcode ?? m.genericName ?? m.manufacturer ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{CATEGORY_LABELS[m.category] ?? m.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">${m.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="tabular-nums font-semibold">{m.stock}</span>
                        <span className="text-xs text-muted-foreground"> {m.unit}s</span>
                        {m.stockStatus === "LOW" && (
                          <div>
                            <Badge className="mt-1 bg-red-100 text-red-800 hover:bg-red-100">
                              Low · reorder at {m.reorderLevel}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {m.expiryDate ? (
                          <Badge
                            className={
                              m.expiryStatus === "EXPIRED" || m.expiryStatus === "EXPIRING"
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                                : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                            }
                          >
                            {format(new Date(m.expiryDate), "MMM yyyy")}
                            {m.expiryStatus === "EXPIRED"
                              ? " · expired"
                              : m.expiryStatus === "EXPIRING"
                                ? " · soon"
                                : ""}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete medicine"
                          onClick={() => onDeleteMedicine(m.id, m.name)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "sales" && (
        <div className="space-y-3">
          {salesData?.items.length === 0 ? (
            <div className="rounded-lg border bg-card p-10 text-center">
              <Pill className="mx-auto size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">No sales yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Dispense medicines to start recording sales.
              </p>
            </div>
          ) : (
            salesData?.items.map((s) => {
              const items = parseJsonArray<{ name: string; quantity: number }>(s.items, []);
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card p-4"
                >
                  <div className="w-20 text-center">
                    <p className="font-mono text-sm font-semibold tabular-nums leading-none">
                      {s.saleNo}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {format(new Date(s.createdAt), "MMM d, HH:mm")}
                    </p>
                  </div>
                  <div className="min-w-40 leading-tight">
                    <p className="font-medium">
                      {s.patient.firstName} {s.patient.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.patient.patientNo}</p>
                  </div>
                  <div className="min-w-44 text-sm leading-tight">
                    <p className="line-clamp-1">
                      {items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {items.length} item{items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <p className="text-sm font-semibold tabular-nums">${s.total.toFixed(2)}</p>
                    <Button size="sm" variant="outline" onClick={() => onPrintReceipt(s)}>
                      <Printer className="size-3.5" /> Receipt
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "purchase" && (
        <>
          <div className="mb-4">
            <Tabs value={poFilter} onValueChange={setPoFilter}>
              <TabsList>
                <TabsTrigger value="ALL">All</TabsTrigger>
                <TabsTrigger value="ORDERED">Ordered</TabsTrigger>
                <TabsTrigger value="RECEIVED">Received</TabsTrigger>
                <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-3">
            {poData?.items.length === 0 ? (
              <div className="rounded-lg border bg-card p-10 text-center">
                <ShoppingCart className="mx-auto size-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium">No purchase orders</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a purchase order to restock medicines.
                </p>
              </div>
            ) : (
              poData?.items.map((po) => {
                const items = parseJsonArray<{ name: string; quantity: number }>(po.items, []);
                return (
                  <div
                    key={po.id}
                    className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card p-4"
                  >
                    <div className="w-20 text-center">
                      <p className="font-mono text-sm font-semibold tabular-nums leading-none">
                        {po.poNo}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {format(new Date(po.createdAt), "MMM d")}
                      </p>
                    </div>
                    <div className="min-w-40 leading-tight">
                      <p className="font-medium">{po.supplier.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {po.supplier.contactPerson ?? "—"}
                      </p>
                    </div>
                    <div className="min-w-44 text-sm leading-tight">
                      <p className="line-clamp-1">{items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</p>
                      <p className="text-xs text-muted-foreground">{items.length} line items</p>
                    </div>
                    <Badge
                      variant={po.status === "RECEIVED" ? "outline" : po.status === "CANCELLED" ? "destructive" : "default"}
                      className={po.status === "ORDERED" ? "bg-primary" : undefined}
                    >
                      {po.status}
                    </Badge>
                    <div className="ml-auto flex items-center gap-2">
                      <p className="text-sm font-semibold tabular-nums">${po.total.toFixed(2)}</p>
                      {po.status === "ORDERED" && (
                        <>
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await apiPatch(`/purchase-orders/${po.id}`, { action: "receive" });
                                toast.success("Stock received");
                                refetchPo();
                                refetch();
                              } catch (error) {
                                toast.error(error instanceof Error ? error.message : "Failed");
                              }
                            }}
                          >
                            <Package className="size-3.5" /> Receive
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (!confirm(`Cancel ${po.poNo}?`)) return;
                              try {
                                await apiPatch(`/purchase-orders/${po.id}`, { action: "cancel" });
                                toast.success("Purchase order cancelled");
                                refetchPo();
                              } catch (error) {
                                toast.error(error instanceof Error ? error.message : "Failed");
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <MedicineDialog
        open={medicineOpen}
        onOpenChange={setMedicineOpen}
        form={medicineForm}
        onSubmit={onCreateMedicine}
      />

      <SaleDialog
        open={saleOpen}
        onOpenChange={setSaleOpen}
        patients={patients?.items ?? []}
        medicines={medicines}
        onSaved={() => {
          refetchSales();
          refetch();
        }}
      />

      <PurchaseOrderDialog
        open={poOpen}
        onOpenChange={setPoOpen}
        suppliers={suppliers?.items ?? []}
        medicines={medicines}
        onSaved={() => {
          refetchPo();
          refetch();
        }}
      />
    </div>
  );
}

function MedicineDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: ReturnType<typeof useForm<z.input<typeof medicineSchema>>>;
  onSubmit: (values: z.input<typeof medicineSchema>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New medicine</DialogTitle>
          <DialogDescription>Add a medicine to the pharmacy catalog.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Paracetamol" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="genericName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Generic name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Acetaminophen" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
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
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Pfizer" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="tablet" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="packSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pack size</FormLabel>
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
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="8901234…" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sell price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening stock</FormLabel>
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
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="reorderLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder level</FormLabel>
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
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="storage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Storage</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Store below 25°C" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Add medicine
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SaleDialog({
  open,
  onOpenChange,
  patients,
  medicines,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patients: PatientOption[];
  medicines: MedicineRow[];
  onSaved: () => void;
}) {
  const [patientId, setPatientId] = React.useState("");
  const [lines, setLines] = React.useState<SaleLine[]>([{ medicineId: "", quantity: 1 }]);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPatientId("");
      setLines([{ medicineId: "", quantity: 1 }]);
      setNotes("");
    }
  }, [open]);

  const total = lines.reduce((sum, l) => {
    const m = medicines.find((x) => x.id === l.medicineId);
    return sum + (m ? m.price * l.quantity : 0);
  }, 0);

  async function onDispense() {
    if (!patientId) {
      toast.error("Select a patient");
      return;
    }
    const items = lines
      .filter((l) => l.medicineId)
      .map((l) => {
        const m = medicines.find((x) => x.id === l.medicineId)!;
        return { medicineId: l.medicineId, quantity: l.quantity, unitPrice: m.price };
      });
    if (items.length === 0) {
      toast.error("Add at least one medicine");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/pharmacy/sales", { patientId, items, notes: notes || undefined });
      toast.success("Medicine dispensed");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dispense failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dispense medicines</DialogTitle>
          <DialogDescription>Bill medicines to a patient and reduce stock.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <FormLabel>Patient</FormLabel>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Search patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} · {p.patientNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {lines.map((line, i) => {
              const m = medicines.find((x) => x.id === line.medicineId);
              return (
                <div key={i} className="grid grid-cols-[1fr_88px_88px_auto] items-center gap-2">
                  <Select
                    value={line.medicineId}
                    onValueChange={(v) =>
                      setLines((l) => l.map((x, j) => (j === i ? { ...x, medicineId: v } : x)))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Medicine" />
                    </SelectTrigger>
                    <SelectContent>
                      {medicines.map((x) => (
                        <SelectItem key={x.id} value={x.id} disabled={x.stock === 0}>
                          {x.name} ({x.stock} in stock)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((l) =>
                        l.map((x, j) =>
                          j === i ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x
                        )
                      )
                    }
                  />
                  <p className="text-right text-sm tabular-nums font-medium">
                    {m ? `$${(m.price * line.quantity).toFixed(2)}` : "—"}
                  </p>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove medicine line"
                    disabled={lines.length === 1}
                    onClick={() => setLines((l) => l.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((l) => [...l, { medicineId: "", quantity: 1 }])}
            >
              <Plus className="size-3.5" /> Add item
            </Button>
          </div>
          <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums">${total.toFixed(2)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onDispense} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Dispense & bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderDialog({
  open,
  onOpenChange,
  suppliers,
  medicines,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  suppliers: SupplierRow[];
  medicines: MedicineRow[];
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = React.useState("");
  const [lines, setLines] = React.useState<PoLine[]>([{ medicineId: "", quantity: 1, unitCost: 0 }]);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSupplierId("");
      setLines([{ medicineId: "", quantity: 1, unitCost: 0 }]);
      setNotes("");
    }
  }, [open]);

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);

  async function onCreate() {
    if (!supplierId) {
      toast.error("Select a supplier");
      return;
    }
    const items = lines.filter((l) => l.medicineId);
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/purchase-orders", { supplierId, items, notes: notes || undefined });
      toast.success("Purchase order created");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New purchase order</DialogTitle>
          <DialogDescription>Order stock from a supplier.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <FormLabel>Supplier</FormLabel>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_88px_auto] items-center gap-2">
                <Select
                  value={line.medicineId}
                  onValueChange={(v) =>
                    setLines((l) =>
                      l.map((x, j) => {
                        if (j !== i) return x;
                        const m = medicines.find((y) => y.id === v);
                        return { ...x, medicineId: v, unitCost: m?.cost ?? 0 };
                      })
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Medicine" />
                  </SelectTrigger>
                  <SelectContent>
                    {medicines.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((l) =>
                      l.map((x, j) =>
                        j === i ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x
                      )
                    )
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={line.unitCost}
                  onChange={(e) =>
                    setLines((l) =>
                      l.map((x, j) => (j === i ? { ...x, unitCost: Number(e.target.value) } : x))
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove line"
                  disabled={lines.length === 1}
                  onClick={() => setLines((l) => l.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((l) => [...l, { medicineId: "", quantity: 1, unitCost: 0 }])}
            >
              <Plus className="size-3.5" /> Add item
            </Button>
          </div>
          <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
            <span className="text-sm text-muted-foreground">Order total</span>
            <span className="text-lg font-semibold tabular-nums">${total.toFixed(2)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
