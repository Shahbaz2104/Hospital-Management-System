"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  HardHat,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  Wrench,
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
import { EQUIPMENT_CATEGORIES, EQUIPMENT_STATUSES } from "@/validators/pharmacy";

type EquipmentRow = {
  id: string;
  name: string;
  code: string;
  category: string;
  manufacturer: string | null;
  serialNo: string | null;
  purchaseDate: string | null;
  purchaseCost: number;
  warrantyExpiry: string | null;
  location: string | null;
  status: string;
  nextMaintenance: string | null;
  notes: string | null;
  warrantyStatus: string | null;
  maintenanceStatus: string | null;
  supplier: { id: string; name: string } | null;
};
type SupplierRow = { id: string; name: string; contactPerson: string | null; phone: string | null; email: string | null };
type MedicineOption = { id: string; name: string; unit: string; stock: number };
type TransactionRow = {
  id: string;
  txNo: string;
  type: string;
  reason: string | null;
  quantity: number;
  balanceAfter: number;
  batchNo: string | null;
  ref: string | null;
  createdAt: string;
  medicine: { id: string; name: string; unit: string };
};

const CATEGORY_LABELS: Record<string, string> = {
  DIAGNOSTIC: "Diagnostic",
  SURGICAL: "Surgical",
  MONITORING: "Monitoring",
  SUPPORT: "Support",
  OTHER: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  OPERATIONAL: "Operational",
  UNDER_MAINTENANCE: "Under maintenance",
  OUT_OF_SERVICE: "Out of service",
  DISPOSED: "Disposed",
};

const equipmentSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  category: z.enum(EQUIPMENT_CATEGORIES).default("DIAGNOSTIC"),
  manufacturer: z.string().trim().optional(),
  supplierId: z.string().optional(),
  serialNo: z.string().trim().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.coerce.number().min(0).default(0),
  warrantyExpiry: z.string().optional(),
  location: z.string().trim().optional(),
  status: z.enum(EQUIPMENT_STATUSES).default("OPERATIONAL"),
  nextMaintenance: z.string().optional(),
  notes: z.string().trim().optional(),
});

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
});

const stockTxSchema = z.object({
  medicineId: z.string().min(1, "Medicine is required"),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]).default("IN"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  reason: z.string().trim().optional(),
});

export function InventoryPage() {
  const [tab, setTab] = React.useState("equipment");
  const [equipmentOpen, setEquipmentOpen] = React.useState(false);
  const [supplierOpen, setSupplierOpen] = React.useState(false);
  const [stockOpen, setStockOpen] = React.useState(false);

  const { data: equipment, isLoading, refetch } = useQuery({
    queryKey: ["equipment"],
    queryFn: () => apiGet<{ items: EquipmentRow[] }>("/equipment"),
  });

  const { data: suppliers, refetch: refetchSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiGet<{ items: SupplierRow[] }>("/suppliers"),
  });

  const { data: transactions, refetch: refetchTx } = useQuery({
    queryKey: ["stock-transactions"],
    queryFn: () => apiGet<{ items: TransactionRow[] }>("/stock-transactions"),
  });

  const { data: medicines, refetch: refetchMedicines } = useQuery({
    queryKey: ["medicines", "ALL"],
    queryFn: () => apiGet<{ items: (MedicineOption & { stockStatus: string })[] }>("/medicines"),
  });

  const equipmentForm = useForm<z.input<typeof equipmentSchema>>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      name: "",
      category: "DIAGNOSTIC",
      manufacturer: "",
      supplierId: "",
      serialNo: "",
      purchaseDate: "",
      purchaseCost: 0,
      warrantyExpiry: "",
      location: "",
      status: "OPERATIONAL",
      nextMaintenance: "",
      notes: "",
    },
  });

  const supplierForm = useForm<z.input<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      taxId: "",
    },
  });

  const stockForm = useForm<z.input<typeof stockTxSchema>>({
    resolver: zodResolver(stockTxSchema),
    defaultValues: {
      medicineId: "",
      type: "IN",
      quantity: 1,
      reason: "",
    },
  });

  async function onCreateEquipment(values: z.input<typeof equipmentSchema>) {
    try {
      await apiPost("/equipment", {
        ...values,
        purchaseDate: values.purchaseDate ? new Date(values.purchaseDate).toISOString() : undefined,
        warrantyExpiry: values.warrantyExpiry ? new Date(values.warrantyExpiry).toISOString() : undefined,
        nextMaintenance: values.nextMaintenance ? new Date(values.nextMaintenance).toISOString() : undefined,
      });
      toast.success("Equipment added");
      setEquipmentOpen(false);
      equipmentForm.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  }

  async function onDeleteEquipment(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await apiDelete(`/equipment/${id}`);
      toast.success("Equipment deleted");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  async function onStatus(id: string, status: string) {
    try {
      await apiPatch(`/equipment/${id}`, { status });
      toast.success("Equipment updated");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function onCreateSupplier(values: z.input<typeof supplierSchema>) {
    try {
      await apiPost("/suppliers", values);
      toast.success("Supplier added");
      setSupplierOpen(false);
      supplierForm.reset();
      refetchSuppliers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  }

  async function onStockTx(values: z.input<typeof stockTxSchema>) {
    try {
      await apiPost("/stock-transactions", values);
      toast.success("Stock updated");
      setStockOpen(false);
      stockForm.reset();
      refetchTx();
      refetchMedicines();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update stock");
    }
  }

  const items = equipment?.items ?? [];
  const operational = items.filter((e) => e.status === "OPERATIONAL").length;
  const maintenance = items.filter((e) => e.status === "UNDER_MAINTENANCE").length;
  const warrantyIssues = items.filter(
    (e) => e.warrantyStatus === "EXPIRING" || e.warrantyStatus === "EXPIRED"
  ).length;
  const txCount = transactions?.items.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Medicine Inventory"
        description="Medical equipment, suppliers and stock movements"
      >
        <Button variant="outline" onClick={() => setStockOpen(true)}>
          <ArrowDownToLine className="size-4" /> Stock in / out
        </Button>
        <Button variant="outline" onClick={() => setSupplierOpen(true)}>
          <Plus className="size-4" /> New supplier
        </Button>
        <Button onClick={() => setEquipmentOpen(true)}>
          <HardHat className="size-4" /> New equipment
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Operational" icon={Settings2} value={operational} loading={isLoading} />
        <StatCard label="Under maintenance" icon={Wrench} value={maintenance} loading={isLoading} />
        <StatCard label="Warranty expiring" icon={HardHat} value={warrantyIssues} loading={isLoading} />
      </div>

      <div className="mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="equipment">Equipment ({items.length})</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers ({suppliers?.items.length ?? 0})</TabsTrigger>
            <TabsTrigger value="ledger">Stock ledger ({txCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "equipment" && (
        <div className="rounded-lg border bg-card">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No equipment registered yet.
            </p>
          ) : (
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Warranty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{e.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{CATEGORY_LABELS[e.category] ?? e.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.location ?? "—"}</td>
                    <td className="px-4 py-3">
                      {e.warrantyExpiry ? (
                        <Badge
                          className={
                            e.warrantyStatus === "EXPIRING" || e.warrantyStatus === "EXPIRED"
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                              : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                          }
                        >
                          {format(new Date(e.warrantyExpiry), "MMM yyyy")}
                          {e.warrantyStatus === "EXPIRED"
                            ? " · expired"
                            : e.warrantyStatus === "EXPIRING"
                              ? " · soon"
                              : ""}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {e.nextMaintenance && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Maintenance {format(new Date(e.nextMaintenance), "MMM d, yyyy")}
                          {e.maintenanceStatus === "DUE" ? " · due" : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Select value={e.status} onValueChange={(v) => onStatus(e.id, v)}>
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EQUIPMENT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onDeleteEquipment(e.id, e.name)}
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
      )}

      {tab === "suppliers" && (
        <div className="rounded-lg border bg-card">
          {suppliers?.items.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No suppliers yet — add one to create purchase orders.
            </p>
          ) : (
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                </tr>
              </thead>
              <tbody>
                {suppliers?.items.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.contactPerson ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "ledger" && (
        <div className="rounded-lg border bg-card">
          {transactions?.items.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No stock movements yet — receive a purchase order or log a stock adjustment.
            </p>
          ) : (
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Ref</th>
                  <th className="px-4 py-3">Medicine</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions?.items.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {t.txNo}
                      {t.ref ? <p className="text-[11px]">{t.ref}</p> : null}
                    </td>
                    <td className="px-4 py-3 font-medium">{t.medicine.name}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          t.type === "IN"
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                            : t.type === "OUT"
                              ? "bg-red-100 text-red-800 hover:bg-red-100"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                        }
                      >
                        {t.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.reason ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {t.quantity > 0 ? "+" : ""}
                      {t.quantity} {t.medicine.unit}s
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.balanceAfter}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {format(new Date(t.createdAt), "MMM d, HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Dialog open={equipmentOpen} onOpenChange={setEquipmentOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New equipment</DialogTitle>
            <DialogDescription>Register a medical equipment asset.</DialogDescription>
          </DialogHeader>
          <Form {...equipmentForm}>
            <form onSubmit={equipmentForm.handleSubmit(onCreateEquipment)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={equipmentForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Patient monitor" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={equipmentForm.control}
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={equipmentForm.control}
                  name="manufacturer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manufacturer</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Philips" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={equipmentForm.control}
                  name="serialNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial no.</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="SN-2026-001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={equipmentForm.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <FormControl>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers?.items.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
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
                  control={equipmentForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ICU — Room 1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={equipmentForm.control}
                  name="purchaseCost"
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
                  control={equipmentForm.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchased</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={equipmentForm.control}
                  name="warrantyExpiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warranty till</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={equipmentForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EQUIPMENT_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_LABELS[s]}
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
                  control={equipmentForm.control}
                  name="nextMaintenance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next maintenance</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEquipmentOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={equipmentForm.formState.isSubmitting}>
                  {equipmentForm.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Add equipment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New supplier</DialogTitle>
            <DialogDescription>Add a supplier for medicines and equipment.</DialogDescription>
          </DialogHeader>
          <Form {...supplierForm}>
            <form onSubmit={supplierForm.handleSubmit(onCreateSupplier)} className="space-y-4">
              <FormField
                control={supplierForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="MedSupply Co." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={supplierForm.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact person</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={supplierForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={supplierForm.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSupplierOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={supplierForm.formState.isSubmitting}>
                  {supplierForm.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Add supplier
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stock in / out</DialogTitle>
            <DialogDescription>Adjust medicine stock and log the movement.</DialogDescription>
          </DialogHeader>
          <Form {...stockForm}>
            <form onSubmit={stockForm.handleSubmit(onStockTx)} className="space-y-4">
              <FormField
                control={stockForm.control}
                name="medicineId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medicine</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select medicine" />
                        </SelectTrigger>
                        <SelectContent>
                          {medicines?.items.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} ({m.stock} in stock)
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
                  control={stockForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IN">
                              <span className="flex items-center gap-2">
                                <ArrowDownToLine className="size-3.5" /> Stock in
                              </span>
                            </SelectItem>
                            <SelectItem value="OUT">
                              <span className="flex items-center gap-2">
                                <ArrowUpFromLine className="size-3.5" /> Stock out
                              </span>
                            </SelectItem>
                            <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={stockForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={stockForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="DAMAGE, EXPIRED, STOCKTAKE…" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStockOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={stockForm.formState.isSubmitting}>
                  {stockForm.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Update stock
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
