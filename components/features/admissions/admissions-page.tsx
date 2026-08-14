"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  BedDouble,
  ClipboardList,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
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
  DialogTrigger,
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

type AdmissionRow = {
  id: string;
  admissionNo: string;
  status: string;
  reason: string | null;
  diagnosis: string | null;
  admittedAt: string;
  dischargeAt: string | null;
  patient: {
    id: string;
    patientNo: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  bed: {
    number: string;
    room: { number: string; type: string };
  } | null;
  doctor: {
    user: { firstName: string; lastName: string; title: string | null };
  } | null;
};

type PatientOption = { id: string; patientNo: string; firstName: string; lastName: string };
type BedOption = {
  id: string;
  number: string;
  status: string;
  room: { number: string; type: string };
};
type DoctorOption = {
  id: string;
  user: { firstName: string; lastName: string; title: string | null };
};

const STATUS_META: Record<string, { label: string; badge: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  ADMITTED: { label: "Admitted", badge: "default", className: "bg-primary" },
  TRANSFERRED: { label: "Transferred", badge: "secondary" },
  DISCHARGED: { label: "Discharged", badge: "outline" },
};

const admitSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  bedId: z.string().optional(),
  doctorId: z.string().optional(),
  reason: z.string().trim().optional(),
  diagnosis: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export function AdmissionsPage() {
  const [open, setOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admissions", statusFilter],
    queryFn: () =>
      apiGet<{ items: AdmissionRow[] }>("/admissions", { status: statusFilter }),
  });

  const { data: patients } = useQuery({
    queryKey: ["patients", "options"],
    queryFn: () =>
      apiGet<{ items: PatientOption[] }>("/patients", { page: 1, pageSize: 100 }),
  });

  const { data: beds } = useQuery({
    queryKey: ["beds", "available"],
    queryFn: () => apiGet<{ items: BedOption[] }>("/beds"),
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors", "options"],
    queryFn: () =>
      apiGet<{ items: DoctorOption[] }>("/doctors", { page: 1, pageSize: 100 }),
  });

  const form = useForm<z.input<typeof admitSchema>>({
    resolver: zodResolver(admitSchema),
    defaultValues: {
      patientId: "",
      bedId: "",
      doctorId: "",
      reason: "",
      diagnosis: "",
      notes: "",
    },
  });

  async function onAdmit(values: z.input<typeof admitSchema>) {
    try {
      await apiPost("/admissions", {
        ...values,
        bedId: values.bedId || undefined,
        doctorId: values.doctorId || undefined,
      });
      toast.success("Patient admitted");
      setOpen(false);
      form.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admission failed");
    }
  }

  async function onTransfer(id: string, name: string) {
    const bedId = prompt(`Select a new bed for ${name} (enter bed number)`);
    if (!bedId) return;
    try {
      await apiPatch(`/admissions/${id}`, { bedId });
      toast.success("Patient transferred");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transfer failed");
    }
  }

  async function onDischarge(id: string, name: string) {
    if (!confirm(`Discharge ${name}? The bed will be freed for cleaning.`)) return;
    try {
      await apiPatch(`/admissions/${id}`, { action: "discharge" });
      toast.success("Patient discharged");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Discharge failed");
    }
  }

  async function onDelete(id: string, admissionNo: string) {
    if (!confirm(`Delete admission ${admissionNo}?`)) return;
    try {
      await apiDelete(`/admissions/${id}`);
      toast.success("Admission deleted");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  const items = data?.items ?? [];
  const counts = {
    admitted: items.filter((a) => a.status === "ADMITTED" || a.status === "TRANSFERRED").length,
    discharged: items.filter((a) => a.status === "DISCHARGED").length,
    occupiedBeds: items.filter((a) => a.status !== "DISCHARGED" && a.bed).length,
  };

  return (
    <div>
      <PageHeader
        title="Admissions"
        description="IPD admissions, bed allocation, transfers and discharges"
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Admit patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Admit patient</DialogTitle>
              <DialogDescription>
                An admission number is generated automatically.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAdmit)} className="space-y-4">
                <FormField
                  control={form.control}
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
                    control={form.control}
                    name="bedId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bed</FormLabel>
                        <FormControl>
                          <Select value={field.value ?? ""} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Assign bed (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              {beds?.items.map((b) => (
                                <SelectItem key={b.id} value={b.id} disabled={b.status !== "AVAILABLE"}>
                                  {b.number} · {b.room.type}
                                  {b.status !== "AVAILABLE" ? " (unavailable)" : ""}
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
                    name="doctorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Doctor</FormLabel>
                        <FormControl>
                          <Select value={field.value ?? ""} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Attending doctor" />
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
                </div>
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason for admission</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Chest pain, observation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="diagnosis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diagnosis</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Provisional diagnosis (optional)" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Admit
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active admissions" icon={ClipboardList} value={counts.admitted} loading={isLoading} />
        <StatCard label="Beds occupied" icon={BedDouble} value={counts.occupiedBeds} hint="from this list" loading={isLoading} />
        <StatCard label="Discharged" icon={RotateCcw} value={counts.discharged} loading={isLoading} />
      </div>

      <div className="mb-4">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="ADMITTED">Admitted</TabsTrigger>
            <TabsTrigger value="TRANSFERRED">Transferred</TabsTrigger>
            <TabsTrigger value="DISCHARGED">Discharged</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center">
            <UserRound className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">No admissions</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Admit a patient to start tracking IPD stays.
            </p>
          </div>
        ) : (
          items.map((a) => {
            const meta = STATUS_META[a.status] ?? STATUS_META.ADMITTED;
            return (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card p-4"
              >
                <div className="w-20 text-center">
                  <p className="text-sm font-semibold tabular-nums leading-none">
                    {a.admissionNo}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {format(new Date(a.admittedAt), "MMM d, HH:mm")}
                  </p>
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
                <div className="min-w-32 leading-tight">
                  <p className="text-sm">
                    {a.bed ? `${a.bed.number}` : "No bed"}
                    {a.bed ? <span className="text-muted-foreground"> · {a.bed.room.type}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.doctor
                      ? `${a.doctor.user.title ? a.doctor.user.title + " " : ""}${a.doctor.user.firstName} ${a.doctor.user.lastName}`
                      : "No doctor"}
                  </p>
                </div>
                <div className="min-w-40 text-sm leading-tight">
                  <p className="line-clamp-1">{a.reason ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.dischargeAt
                      ? `Discharged ${format(new Date(a.dischargeAt), "MMM d, yyyy")}`
                      : "Admitted"}
                  </p>
                </div>
                <Badge className={meta.className} variant={meta.badge}>
                  {meta.label}
                </Badge>
                <div className="ml-auto flex items-center gap-1.5">
                  {a.status !== "DISCHARGED" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onTransfer(a.id, `${a.patient.firstName} ${a.patient.lastName}`)
                        }
                      >
                        Transfer
                      </Button>
                      <Button size="sm" onClick={() => onDischarge(a.id, `${a.patient.firstName} ${a.patient.lastName}`)}>
                        Discharge
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete admission"
                    onClick={() => onDelete(a.id, a.admissionNo)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
