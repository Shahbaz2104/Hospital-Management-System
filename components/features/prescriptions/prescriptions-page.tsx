"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileDown, Loader2, Plus, QrCode, Stethoscope, FileText, Pill } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

type PrescriptionItem = {
  medicine: string;
  medicineId?: string | null;
  dose?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
};

type PrescriptionRow = {
  id: string;
  prescriptionNo: string;
  status: string;
  diagnosis: string | null;
  notes: string | null;
  items: string;
  issuedAt: string;
  patient: { patientNo: string; firstName: string; lastName: string };
  doctor: { user: { title: string | null; firstName: string; lastName: string } } | null;
};

type PatientOption = { id: string; patientNo: string; firstName: string; lastName: string };
type DoctorOption = { id: string; user: { title: string | null; firstName: string; lastName: string } };
type MedicineOption = { id: string; name: string; unit: string };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  COMPLETED: { label: "Completed", cls: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

function parseItems(raw: string): PrescriptionItem[] {
  try {
    return JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
}

export function PrescriptionsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["prescriptions"],
    queryFn: () => apiGet<{ items: PrescriptionRow[]; total: number }>("/prescriptions"),
  });

  const items = data?.items ?? [];
  const active = items.filter((p) => p.status === "ACTIVE").length;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
  }

  return (
    <div>
      <PageHeader
        title="Prescriptions"
        description="Issue, print and verify electronic prescriptions"
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New prescription
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" icon={FileText} value={data?.total ?? items.length} loading={isLoading} />
        <StatCard label="Active" icon={Pill} value={active} loading={isLoading} />
        <StatCard label="Completed" icon={FileDown} value={items.filter((p) => p.status === "COMPLETED").length} loading={isLoading} />
        <StatCard label="Cancelled" icon={QrCode} value={items.filter((p) => p.status === "CANCELLED").length} loading={isLoading} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
          No prescriptions yet. Issue the first one.
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm">
          {items.map((p) => {
            const meta = STATUS_META[p.status] ?? STATUS_META.ACTIVE;
            const parsed = parseItems(p.items);
            return (
              <div key={p.id} className="flex items-start gap-4 border-b px-5 py-4 last:border-0">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Stethoscope className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.prescriptionNo}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {p.patient.firstName} {p.patient.lastName} · {p.patient.patientNo}
                    </Badge>
                    <Badge className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {p.diagnosis ? `Diagnosis: ${p.diagnosis}` : "No diagnosis"}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {parsed.map((i) => i.medicine).join(", ") || "No items"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.doctor ? `Dr. ${p.doctor.user.firstName} ${p.doctor.user.lastName}` : "—"} ·{" "}
                    {format(new Date(p.issuedAt), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <PrescriptionStatusSelect prescription={p} onDone={invalidate} />
                  <Button size="sm" variant="outline" title="Download PDF">
                    <a href={`/api/prescriptions/${p.id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1">
                      <FileDown className="size-3.5" /> PDF
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <CreatePrescriptionDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); invalidate(); }}
        />
      )}
    </div>
  );
}

function PrescriptionStatusSelect({
  prescription,
  onDone,
}: {
  prescription: PrescriptionRow;
  onDone: () => void;
}) {
  const mut = useMutation({
    mutationFn: (status: string) => apiPatch(`/prescriptions/${prescription.id}`, { status }),
    onSuccess: () => { toast.success("Status updated"); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });
  return (
    <Select value={prescription.status} onValueChange={(v) => mut.mutate(v)}>
      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_META).map(([k, m]) => (
          <SelectItem key={k} value={k}>{m.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreatePrescriptionDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [patientId, setPatientId] = React.useState("");
  const [doctorId, setDoctorId] = React.useState("");
  const [diagnosis, setDiagnosis] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [rows, setRows] = React.useState<PrescriptionItem[]>([{ medicine: "", dose: "", frequency: "", duration: "", instructions: "" }]);

  const { data: patients } = useQuery({
    queryKey: ["rx-patients"],
    queryFn: () => apiGet<{ items: PatientOption[] }>("/patients?pageSize=50"),
  });
  const { data: doctors } = useQuery({
    queryKey: ["rx-doctors"],
    queryFn: () => apiGet<{ items: DoctorOption[] }>("/doctors"),
  });
  const { data: medicines } = useQuery({
    queryKey: ["rx-medicines"],
    queryFn: () => apiGet<{ items: MedicineOption[] }>("/medicines"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      apiPost("/prescriptions", {
        patientId,
        doctorId: doctorId || undefined,
        diagnosis: diagnosis.trim() || undefined,
        notes: notes.trim() || undefined,
        items: rows
          .filter((r) => r.medicine.trim())
          .map((r) => ({
            medicine: r.medicine.trim(),
            dose: r.dose?.trim() || undefined,
            frequency: r.frequency?.trim() || undefined,
            duration: r.duration?.trim() || undefined,
            instructions: r.instructions?.trim() || undefined,
          })),
      }),
    onSuccess: () => {
      toast.success("Prescription issued");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to issue prescription"),
  });

  const valid = patientId && rows.some((r) => r.medicine.trim());

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New prescription</DialogTitle>
          <DialogDescription>Issued electronically with a QR verification code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Patient *</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {patients?.items.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName} · {p.patientNo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {doctors?.items.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.user.title ? `${d.user.title} ` : ""}{d.user.firstName} {d.user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Diagnosis</Label>
            <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">Medicines *</Label>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1.4fr_0.8fr_1fr_0.8fr]">
                  <div>
                    <Label className="mb-0.5 block text-[10px] text-muted-foreground">Medicine</Label>
                    <Select
                      value={row.medicine}
                      onValueChange={(v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, medicine: v } : r)))}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder="Pick medicine…" /></SelectTrigger>
                      <SelectContent>
                        {medicines?.items.map((m) => (
                          <SelectItem key={m.id} value={m.name}>{m.name}{m.unit ? ` (${m.unit})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-0.5 block text-[10px] text-muted-foreground">Dose</Label>
                    <Input
                      className="h-8"
                      value={row.dose ?? ""}
                      placeholder="500 mg"
                      onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, dose: e.target.value } : r)))}
                    />
                  </div>
                  <div>
                    <Label className="mb-0.5 block text-[10px] text-muted-foreground">Frequency</Label>
                    <Input
                      className="h-8"
                      value={row.frequency ?? ""}
                      placeholder="2× daily"
                      onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, frequency: e.target.value } : r)))}
                    />
                  </div>
                  <div>
                    <Label className="mb-0.5 block text-[10px] text-muted-foreground">Duration</Label>
                    <Input
                      className="h-8"
                      value={row.duration ?? ""}
                      placeholder="7 days"
                      onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, duration: e.target.value } : r)))}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setRows((rs) => [...rs, { medicine: "", dose: "", frequency: "", duration: "", instructions: "" }])}
            >
              <Plus className="size-3.5" /> Add medicine
            </Button>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Instructions</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Take after meals. Follow up in 7 days." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!valid || createMut.isPending}>
            {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Issue prescription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
