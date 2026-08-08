"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlarmClock,
  Ambulance,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Stethoscope,
} from "lucide-react";

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

type EmergencyCase = {
  id: string;
  caseNo: string;
  triageLevel: string;
  condition: string | null;
  status: string;
  vitals: string | null;
  walkInName: string | null;
  walkInPhone: string | null;
  age: number | null;
  gender: string | null;
  ambulanceRequested: boolean;
  ambulanceDispatchedAt: string | null;
  ambulanceEtaMinutes: number | null;
  ambulanceNotes: string | null;
  createdAt: string;
  patient: { id: string; patientNo: string; firstName: string; lastName: string } | null;
  assignedDoctor: { id: string; user: { title: string | null; firstName: string; lastName: string } } | null;
  admittedAsAdmission: { admissionNo: string } | null;
  events: Array<{ id: string; type: string; note: string | null; createdAt: string; createdBy: { firstName: string; lastName: string } | null }>;
};

type PatientOption = { id: string; patientNo: string; firstName: string; lastName: string; gender: string | null };
type DoctorOption = { id: string; user: { title: string | null; firstName: string; lastName: string } };

const TRIAGE_META: Record<string, { label: string; cls: string; dot: string }> = {
  RED: { label: "Critical", cls: "bg-red-500/10 text-red-600 dark:text-red-400", dot: "bg-red-500" },
  ORANGE: { label: "Urgent", cls: "bg-orange-500/10 text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  YELLOW: { label: "Moderate", cls: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-500" },
  GREEN: { label: "Stable", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  WAITING: { label: "Waiting", cls: "bg-muted text-muted-foreground" },
  IN_PROGRESS: { label: "In progress", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  STABILIZED: { label: "Stabilized", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  TRANSFERRED: { label: "Transferred", cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  ADMITTED: { label: "Admitted", cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  DISCHARGED: { label: "Discharged", cls: "bg-muted text-muted-foreground" },
};

const TRIAGE_ORDER = ["RED", "ORANGE", "YELLOW", "GREEN"];

function VitalsBadges({ vitals }: { vitals: string | null }) {
  if (!vitals) return null;
  try {
    const v = JSON.parse(vitals) as Record<string, string>;
    return (
      <span className="mt-1 flex flex-wrap gap-1">
        {Object.entries(v).map(([k, val]) => val ? (
          <Badge key={k} variant="outline" className="text-[10px] font-normal">
            {k.toUpperCase()} {val}
          </Badge>
        ) : null)}
      </span>
    );
  } catch {
    return null;
  }
}

export function EmergencyPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [selected, setSelected] = React.useState<EmergencyCase | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [ambulanceOpen, setAmbulanceOpen] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["emergency", statusFilter],
    queryFn: () =>
      apiGet<{ items: EmergencyCase[]; total: number; statusCounts: Record<string, number> }>("/emergency", {
        status: statusFilter || undefined,
      }),
  });

  const { data: patients } = useQuery({
    queryKey: ["emergency-patients"],
    queryFn: () => apiGet<{ items: PatientOption[] }>("/patients?pageSize=50"),
  });
  const { data: doctors } = useQuery({
    queryKey: ["emergency-doctors"],
    queryFn: () => apiGet<{ items: DoctorOption[] }>("/doctors"),
  });

  const items = data?.items ?? [];
  const statusCounts = data?.statusCounts ?? {};

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["emergency"] });
  }

  return (
    <div>
      <PageHeader
        title="Emergency"
        description="Triage queue, ambulances and case timeline"
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New case
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Critical (RED)" icon={AlarmClock} value={statusCounts.WAITING ?? 0} loading={isLoading} />
        <StatCard label="Waiting" icon={Clock} value={items.filter((c) => c.status === "WAITING").length} loading={isLoading} />
        <StatCard label="In progress" icon={Stethoscope} value={items.filter((c) => c.status === "IN_PROGRESS").length} loading={isLoading} />
        <StatCard label="Ambulance on way" icon={Ambulance} value={items.filter((c) => c.ambulanceRequested && !c.ambulanceDispatchedAt).length} loading={isLoading} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={statusFilter === "" ? "default" : "outline"}
          onClick={() => setStatusFilter("")}
        >
          All
        </Button>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <Button
            key={key}
            size="sm"
            variant={statusFilter === key ? "default" : "outline"}
            onClick={() => setStatusFilter(key)}
          >
            {meta.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
          No emergency cases{statusFilter ? ` with status ${STATUS_META[statusFilter]?.label}` : ""}.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => {
            const triage = TRIAGE_META[c.triageLevel] ?? TRIAGE_META.GREEN;
            const status = STATUS_META[c.status] ?? STATUS_META.WAITING;
            const name = c.patient
              ? `${c.patient.firstName} ${c.patient.lastName}`
              : c.walkInName ?? "Walk-in";
            return (
              <div key={c.id} className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 shadow-sm">
                <span className={`size-2.5 shrink-0 rounded-full ${triage.dot}`} title={triage.label} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{name}</span>
                    <Badge variant="secondary" className="text-[10px]">{c.caseNo}</Badge>
                    <Badge className={`text-[10px] ${triage.cls}`}>{triage.label}</Badge>
                    <Badge className={`text-[10px] ${status.cls}`}>{status.label}</Badge>
                    {c.ambulanceRequested && (
                      <Badge variant="outline" className="text-[10px]">
                        <Ambulance className="mr-1 size-3" />
                        {c.ambulanceDispatchedAt ? `ETA ${c.ambulanceEtaMinutes ?? "?"} min` : "Requested"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.condition || "No condition noted"}
                    {c.age ? ` · ${c.age}y` : ""}
                    {c.gender ? ` · ${c.gender}` : ""}
                  </p>
                  <VitalsBadges vitals={c.vitals} />
                </div>
                <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                  {format(new Date(c.createdAt), "HH:mm")}
                  <span className="block">{c.assignedDoctor ? `Dr. ${c.assignedDoctor.user.firstName} ${c.assignedDoctor.user.lastName}` : "Unassigned"}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelected(c)}>
                  Open <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <CaseDrawer
          case_={selected}
          doctors={doctors?.items ?? []}
          onClose={() => setSelected(null)}
          onUpdated={invalidate}
          onAmbulance={() => { setAmbulanceOpen(selected.id); setSelected(null); }}
        />
      )}

      {createOpen && (
        <CreateCaseDialog
          patients={patients?.items ?? []}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); invalidate(); }}
        />
      )}

      {ambulanceOpen && (
        <AmbulanceDialog
          caseId={ambulanceOpen}
          onClose={() => setAmbulanceOpen(null)}
          onDispatched={() => { setAmbulanceOpen(null); invalidate(); }}
        />
      )}
    </div>
  );
}

function CaseDrawer({
  case_,
  doctors,
  onClose,
  onUpdated,
  onAmbulance,
}: {
  case_: EmergencyCase;
  doctors: DoctorOption[];
  onClose: () => void;
  onUpdated: () => void;
  onAmbulance: () => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState(case_.status);
  const [triage, setTriage] = React.useState(case_.triageLevel);
  const [doctorId, setDoctorId] = React.useState(case_.assignedDoctor?.id ?? "");
  const [eventNote, setEventNote] = React.useState("");
  const [eventType, setEventType] = React.useState("NOTE");

  const { data: detail } = useQuery({
    queryKey: ["emergency-detail", case_.id],
    queryFn: () => apiGet<{ case: EmergencyCase; events: Array<{ id: string; type: string; note: string | null; createdAt: string; createdBy: { firstName: string; lastName: string } | null }> }>(`/emergency/${case_.id}`),
  });

  const updateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPatch(`/emergency/${case_.id}`, body),
    onSuccess: () => {
      toast.success("Case updated");
      queryClient.invalidateQueries({ queryKey: ["emergency"] });
      queryClient.invalidateQueries({ queryKey: ["emergency-detail", case_.id] });
      onUpdated();
    },
  });

  const eventMut = useMutation({
    mutationFn: (body: { type: string; note: string }) => apiPost(`/emergency/${case_.id}/events`, body),
    onSuccess: () => {
      setEventNote("");
      toast.success("Timeline event added");
      queryClient.invalidateQueries({ queryKey: ["emergency-detail", case_.id] });
    },
  });

  const events = detail?.events ?? case_.events ?? [];
  const vitals = (() => {
    try { return detail?.case?.vitals ? JSON.parse(detail.case.vitals) : null; } catch { return null; }
  })();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {case_.caseNo}
            <Badge variant="secondary" className="text-[10px]">
              {case_.patient ? `${case_.patient.patientNo}` : "Walk-in"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Opened {format(new Date(case_.createdAt), "MMM d, yyyy HH:mm")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-semibold">Status & triage</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={(v) => { setStatus(v); updateMut.mutate({ status: v }); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Triage</Label>
                <Select value={triage} onValueChange={(v) => { setTriage(v); updateMut.mutate({ triageLevel: v }); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIAGE_ORDER.map((k) => <SelectItem key={k} value={k}>{TRIAGE_META[k].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Assign doctor</Label>
                <Select
                  value={doctorId}
                  onValueChange={(v) => { setDoctorId(v); updateMut.mutate({ assignedDoctorId: v || null }); }}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.user.title ? `${d.user.title} ` : ""}{d.user.firstName} {d.user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {vitals && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(vitals).filter(([, v]) => v).map(([k, v]) => (
                  <Badge key={k} variant="outline">{k.toUpperCase()} {String(v)}</Badge>
                ))}
              </div>
            )}
            {case_.admittedAsAdmission && (
              <p className="mt-3 text-xs text-muted-foreground">
                Admitted as <Link href="/admissions" className="font-medium underline">{case_.admittedAsAdmission.admissionNo}</Link>
              </p>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Ambulance</p>
              {!case_.ambulanceDispatchedAt && (
                <Button size="sm" variant="outline" onClick={onAmbulance}>
                  <Ambulance className="size-3.5" /> Dispatch
                </Button>
              )}
            </div>
            {case_.ambulanceRequested ? (
              <p className="text-xs text-muted-foreground">
                {case_.ambulanceDispatchedAt
                  ? `Dispatched ${format(new Date(case_.ambulanceDispatchedAt), "HH:mm")}${case_.ambulanceEtaMinutes ? ` · ETA ${case_.ambulanceEtaMinutes} min` : ""}`
                  : "Ambulance requested — not yet dispatched."}
                {case_.ambulanceNotes ? ` · ${case_.ambulanceNotes}` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No ambulance requested for this case.</p>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-semibold">Timeline</p>
            <div className="mb-3 flex gap-2">
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["NOTE", "STATUS", "AMBULANCE", "DOCTOR", "ADMISSION"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={eventNote}
                onChange={(e) => setEventNote(e.target.value)}
                placeholder="Add a timeline note…"
                className="h-8 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && eventNote.trim()) {
                    eventMut.mutate({ type: eventType, note: eventNote.trim() });
                  }
                }}
              />
              <Button size="sm" className="h-8" disabled={!eventNote.trim() || eventMut.isPending} onClick={() => eventMut.mutate({ type: eventType, note: eventNote.trim() })}>
                {eventMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
              </Button>
            </div>
            <div className="space-y-2">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No timeline events yet.</p>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="flex gap-2 text-xs">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">
                        {format(new Date(e.createdAt), "HH:mm")} · {e.type}
                        {e.createdBy ? ` · ${e.createdBy.firstName} ${e.createdBy.lastName}` : ""}:
                      </span>{" "}
                      <span>{e.note ?? "—"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateCaseDialog({
  patients,
  onClose,
  onCreated,
}: {
  patients: PatientOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = React.useState("");
  const [walkInName, setWalkInName] = React.useState("");
  const [walkInPhone, setWalkInPhone] = React.useState("");
  const [age, setAge] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [triage, setTriage] = React.useState("GREEN");
  const [condition, setCondition] = React.useState("");
  const [bp, setBp] = React.useState("");
  const [pulse, setPulse] = React.useState("");
  const [temp, setTemp] = React.useState("");
  const [spo2, setSpo2] = React.useState("");
  const [ambulance, setAmbulance] = React.useState(false);

  const createMut = useMutation({
    mutationFn: () =>
      apiPost("/emergency", {
        patientId: patientId || undefined,
        walkInName: walkInName || undefined,
        walkInPhone: walkInPhone || undefined,
        age: age ? Number(age) : undefined,
        gender: gender || undefined,
        triageLevel: triage,
        condition: condition || undefined,
        vitals: { bp, pulse, temp, spo2 },
        ambulanceRequested: ambulance,
      }),
    onSuccess: () => {
      toast.success("Emergency case created");
      queryClient.invalidateQueries({ queryKey: ["emergency"] });
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create case"),
  });

  const canSubmit = patientId || walkInName.trim();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New emergency case</DialogTitle>
          <DialogDescription>Register a casualty for the triage queue.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3">
            <Label className="text-xs">Patient</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder="Select a registered patient (or use walk-in below)" /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName} · {p.patientNo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Walk-in name</Label>
              <Input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} placeholder="Unknown / walk-in" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Walk-in phone</Label>
              <Input value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Age</Label>
              <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Triage</Label>
              <Select value={triage} onValueChange={setTriage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIAGE_ORDER.map((k) => <SelectItem key={k} value={k}>{TRIAGE_META[k].label} ({k})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Condition / chief complaint</Label>
            <Textarea value={condition} onChange={(e) => setCondition(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Vitals</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Input value={bp} onChange={(e) => setBp(e.target.value)} placeholder="BP" className="h-9" />
              <Input value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="Pulse" className="h-9" />
              <Input value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="Temp" className="h-9" />
              <Input value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="SpO2" className="h-9" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ambulance} onChange={(e) => setAmbulance(e.target.checked)} className="size-4 rounded border-input" />
            Ambulance requested
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!canSubmit || createMut.isPending}>
            {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AmbulanceDialog({
  caseId,
  onClose,
  onDispatched,
}: {
  caseId: string;
  onClose: () => void;
  onDispatched: () => void;
}) {
  const [eta, setEta] = React.useState("10");
  const [notes, setNotes] = React.useState("");
  const mut = useMutation({
    mutationFn: () => apiPost(`/emergency/${caseId}/ambulance`, { etaMinutes: Number(eta), notes: notes || undefined }),
    onSuccess: () => { toast.success("Ambulance dispatched"); onDispatched(); },
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dispatch ambulance</DialogTitle>
          <DialogDescription>Record the estimated arrival for the emergency team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">ETA (minutes)</Label>
            <Input type="number" min={1} max={600} value={eta} onChange={(e) => setEta(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Ambulance unit, pickup location, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ambulance className="size-4" />}
            Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
