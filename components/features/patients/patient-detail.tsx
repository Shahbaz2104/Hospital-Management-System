"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Loader2, Pencil, Printer, Phone, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { apiGet, apiPatch } from "@/lib/api";
import { BLOOD_GROUPS, GENDERS } from "@/validators/clinical";

type AppointmentRow = {
  id: string;
  tokenNo: string;
  date: string;
  startTime: string;
  type: string;
  status: string;
  reason: string | null;
  doctor: {
    user: { firstName: string; lastName: string; title: string | null };
  } | null;
};

type PatientDetail = {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  gender: string | null;
  bloodGroup: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  emergencyContact: string | null;
  heightCm: number | null;
  weightKg: number | null;
  allergies: string | null;
  medicalHistory: string | null;
  previousDiseases: string | null;
  currentMedication: string | null;
  vaccinationHistory: string | null;
  insuranceProvider: string | null;
  insuranceNumber: string | null;
  insurancePlan: string | null;
  insuranceExpiry: string | null;
  status: string;
  appointments: AppointmentRow[];
};

type ConsultationRow = {
  id: string;
  consultationNo: string;
  diagnosis: string | null;
  notes: string | null;
  followUpDate: string | null;
  vitals: string | null;
  prescriptions: string | null;
  createdAt: string;
  doctor: {
    user: { firstName: string; lastName: string; title: string | null };
  } | null;
};

const editSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  dob: z.string().optional(),
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  heightCm: z.string().optional(),
  weightKg: z.string().optional(),
  allergies: z.string().trim().optional(),
  medicalHistory: z.string().trim().optional(),
  previousDiseases: z.string().trim().optional(),
  currentMedication: z.string().trim().optional(),
  vaccinationHistory: z.string().trim().optional(),
  insuranceProvider: z.string().trim().optional(),
  insuranceNumber: z.string().trim().optional(),
  insurancePlan: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
});

const STATUS_META: Record<string, { label: string; badge: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending", badge: "secondary" },
  CONFIRMED: { label: "Confirmed", badge: "default" },
  COMPLETED: { label: "Completed", badge: "outline" },
  CANCELLED: { label: "Cancelled", badge: "destructive" },
  MISSED: { label: "Missed", badge: "destructive" },
};

function ageOf(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

export function PatientDetail() {
  const params = useParams<{ id: string }>();
  const [editing, setEditing] = React.useState(false);

  const { data: patient, isLoading, refetch } = useQuery({
    queryKey: ["patient", params.id],
    queryFn: () => apiGet<PatientDetail>(`/patients/${params.id}`),
    enabled: !!params.id,
  });

  const { data: consultations } = useQuery({
    queryKey: ["consultations", params.id],
    queryFn: () =>
      apiGet<{ items: ConsultationRow[] }>("/consultations", {
        patientId: params.id,
      }),
    enabled: !!params.id,
  });

  const form = useForm<z.input<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      dob: "",
      gender: undefined,
      bloodGroup: undefined,
      heightCm: "",
      weightKg: "",
      allergies: "",
      medicalHistory: "",
      previousDiseases: "",
      currentMedication: "",
      vaccinationHistory: "",
      insuranceProvider: "",
      insuranceNumber: "",
      insurancePlan: "",
      address: "",
      city: "",
      emergencyContact: "",
    },
  });

  React.useEffect(() => {
    if (!patient) return;
    form.reset({
      firstName: patient.firstName,
      lastName: patient.lastName,
      phone: patient.phone ?? "",
      email: patient.email ?? "",
      dob: patient.dob ? format(new Date(patient.dob), "yyyy-MM-dd") : "",
      gender: (patient.gender as "MALE" | "FEMALE" | "OTHER") ?? undefined,
      bloodGroup: (patient.bloodGroup as "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-") ?? undefined,
      heightCm: patient.heightCm != null ? String(patient.heightCm) : "",
      weightKg: patient.weightKg != null ? String(patient.weightKg) : "",
      allergies: patient.allergies ?? "",
      medicalHistory: patient.medicalHistory ?? "",
      previousDiseases: patient.previousDiseases ?? "",
      currentMedication: patient.currentMedication ?? "",
      vaccinationHistory: patient.vaccinationHistory ?? "",
      insuranceProvider: patient.insuranceProvider ?? "",
      insuranceNumber: patient.insuranceNumber ?? "",
      insurancePlan: patient.insurancePlan ?? "",
      address: patient.address ?? "",
      city: patient.city ?? "",
      emergencyContact: patient.emergencyContact ?? "",
    });
  }, [patient, form]);

  async function onSave(values: z.input<typeof editSchema>) {
    try {
      await apiPatch(`/patients/${params.id}`, {
        ...values,
        dob: values.dob ? new Date(values.dob) : undefined,
        heightCm: values.heightCm ? Number(values.heightCm) : undefined,
        weightKg: values.weightKg ? Number(values.weightKg) : undefined,
        gender: values.gender || undefined,
        bloodGroup: values.bloodGroup || undefined,
      });
      toast.success("Patient updated");
      setEditing(false);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function onPrintCard() {
    if (!patient) return;
    let qr: string | null = null;
    try {
      const QRCode = (await import("qrcode")).default;
      qr = await QRCode.toDataURL(
        JSON.stringify({
          id: patient.id,
          patientNo: patient.patientNo,
          name: `${patient.firstName} ${patient.lastName}`,
        })
      );
    } catch {
      // QR is optional — the slip still prints without it.
    }
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Patient ID — ${patient.patientNo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:ui-sans-serif,system-ui,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a}
        .card{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;max-width:340px;margin:0 auto}
        .head{background:#2563eb;color:#fff;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}
        .head h1{font-size:15px;font-weight:700;letter-spacing:-0.01em}
        .head p{font-size:11px;opacity:.85;margin-top:2px}
        .body{padding:20px;display:flex;gap:18px}
        .qr{width:110px;height:110px;flex:none;border:1px solid #e2e8f0;border-radius:10px;padding:6px}
        .info{flex:1}
        .name{font-size:17px;font-weight:700}
        .mono{font-family:ui-monospace,monospace;font-size:13px;color:#2563eb;font-weight:600;margin-top:2px}
        .meta{margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;font-size:12px}
        .meta span{color:#64748b}
        .meta b{font-weight:600;color:#0f172a;display:block}
        .foot{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 20px;font-size:10px;color:#94a3b8}
      </style></head><body><div class="card">
        <div class="head"><div><h1>City Care Hospital</h1><p>Patient Identification Card</p></div><div style="text-align:right"><b style="font-size:13px">${patient.bloodGroup ?? "—"}</b><p>Blood group</p></div></div>
        <div class="body">
          <div class="info">
            <div class="name">${patient.firstName} ${patient.lastName}</div>
            <div class="mono">${patient.patientNo}</div>
            <div class="meta">
              <div><span>Gender</span><b>${patient.gender ? patient.gender.toLowerCase() : "—"}</b></div>
              <div><span>Age</span><b>${patient.dob ? ageOf(patient.dob) + " yrs" : "—"}</b></div>
              ${patient.phone ? `<div><span>Phone</span><b>${patient.phone}</b></div>` : ""}
              ${patient.emergencyContact ? `<div><span>Emergency</span><b>${patient.emergencyContact}</b></div>` : ""}
              ${patient.allergies ? `<div style="grid-column:1/-1"><span>Allergies</span><b style="color:#dc2626">${patient.allergies}</b></div>` : ""}
            </div>
          </div>
          ${qr ? `<img class="qr" src="${qr}" alt="QR"/>` : ""}
        </div>
        <div class="foot">Present this card at registration. For emergencies call +1 555 000 911.</div>
      </div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  if (isLoading || !patient) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const lastVisit = patient.appointments[0]?.date;
  const completed = patient.appointments.filter((a) => a.status === "COMPLETED").length;

  return (
    <div>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {patient.firstName[0]}
                {patient.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="text-xl font-semibold tracking-tight sm:text-2xl">
                {patient.firstName} {patient.lastName}
              </span>
              <p className="text-sm font-mono text-muted-foreground">
                {patient.patientNo}
                {patient.dob ? ` · ${ageOf(patient.dob)} yrs` : ""}
              </p>
            </div>
          </div>
        }
        description={patient.status === "ACTIVE" ? "Registered patient" : "Inactive patient"}
      >
        <Button variant="outline" onClick={onPrintCard}>
          <Printer className="size-4" /> Print ID card
        </Button>
        <Button onClick={() => setEditing(true)}>
          <Pencil className="size-4" /> Edit
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Visits" icon={UserRound} value={patient.appointments.length} hint={`${completed} completed`} />
        <StatCard
          label="Last visit"
          icon={Phone}
          value={lastVisit ? format(new Date(lastVisit), "MMM d, yyyy") : "None"}
        />
        <StatCard label="Blood group" icon={Phone} value={patient.bloodGroup ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold">Consultations</h2>
            {(consultations?.items.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No consultations recorded yet.
              </p>
            ) : (
              <div className="divide-y">
                {consultations?.items.map((c) => {
                  const vitals = c.vitals
                    ? (JSON.parse(c.vitals) as { name: string; value: string; unit?: string }[])
                    : [];
                  const rx = c.prescriptions
                    ? (JSON.parse(
                        c.prescriptions
                      ) as { medicine: string; dose?: string; frequency?: string; duration?: string }[])
                    : [];
                  return (
                    <div key={c.id} className="py-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <p className="font-mono text-xs font-semibold text-primary">
                          {c.consultationNo}
                        </p>
                        <p className="text-sm font-medium">{c.diagnosis ?? "Consultation"}</p>
                        <p className="ml-auto text-xs text-muted-foreground">
                          {format(new Date(c.createdAt), "MMM d, yyyy HH:mm")}
                          {c.doctor
                            ? ` · ${c.doctor.user.title ? c.doctor.user.title + " " : ""}${c.doctor.user.firstName} ${c.doctor.user.lastName}`
                            : ""}
                        </p>
                      </div>
                      {vitals.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {vitals.map((v) => (
                            <Badge key={v.name} variant="outline" className="font-mono text-[11px]">
                              {v.name} {v.value}
                              {v.unit ? ` ${v.unit}` : ""}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {rx.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {rx.map((r, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{r.medicine}</span>
                              {r.dose ? ` · ${r.dose}` : ""}
                              {r.frequency ? ` · ${r.frequency}` : ""}
                              {r.duration ? ` · ${r.duration}` : ""}
                            </p>
                          ))}
                        </div>
                      )}
                      {c.followUpDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Follow-up: {format(new Date(c.followUpDate), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold">Appointment history</h2>
            {patient.appointments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No appointments yet.
              </p>
            ) : (
              <div className="divide-y">
                {patient.appointments.map((a) => {
                  const meta = STATUS_META[a.status] ?? STATUS_META.PENDING;
                  return (
                    <div key={a.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
                      <div className="w-24">
                        <p className="text-sm font-semibold tabular-nums">{a.startTime}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(a.date + "T00:00:00"), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="min-w-40 leading-tight">
                        <p className="text-sm font-medium">{a.tokenNo}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.doctor
                            ? `${a.doctor.user.title ? a.doctor.user.title + " " : ""}${a.doctor.user.firstName} ${a.doctor.user.lastName}`
                            : "Unassigned"}
                          {a.reason ? ` · ${a.reason}` : ""}
                        </p>
                      </div>
                      <Badge variant={meta.badge} className="ml-auto">
                        {meta.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold">Personal</h2>
            <div className="divide-y">
              <DetailRow label="Phone" value={patient.phone} />
              <DetailRow label="Email" value={patient.email} />
              <DetailRow label="Address" value={[patient.address, patient.city].filter(Boolean).join(", ")} />
              <DetailRow label="Emergency" value={patient.emergencyContact} />
              <DetailRow
                label="Build"
                value={
                  patient.heightCm || patient.weightKg
                    ? `${patient.heightCm ?? "—"} cm · ${patient.weightKg ?? "—"} kg`
                    : null
                }
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold">Medical</h2>
            <div className="divide-y">
              <DetailRow label="Allergies" value={patient.allergies} />
              <DetailRow label="History" value={patient.medicalHistory} />
              <DetailRow label="Previous diseases" value={patient.previousDiseases} />
              <DetailRow label="Current medication" value={patient.currentMedication} />
              <DetailRow label="Vaccinations" value={patient.vaccinationHistory} />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold">Insurance</h2>
            <div className="divide-y">
              <DetailRow label="Provider" value={patient.insuranceProvider} />
              <DetailRow label="Number" value={patient.insuranceNumber} />
              <DetailRow label="Plan" value={patient.insurancePlan} />
              <DetailRow
                label="Expiry"
                value={patient.insuranceExpiry ? format(new Date(patient.insuranceExpiry), "MMM yyyy") : null}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit patient</DialogTitle>
            <DialogDescription>Update demographic and medical details.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <FormControl>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {GENDERS.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g.charAt(0) + g.slice(1).toLowerCase()}
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
                  name="bloodGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood group</FormLabel>
                      <FormControl>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {BLOOD_GROUPS.map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
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
                  control={form.control}
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
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="heightCm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (cm)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weightKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="allergies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allergies</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency contact</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="medicalHistory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical history</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentMedication"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current medication</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
