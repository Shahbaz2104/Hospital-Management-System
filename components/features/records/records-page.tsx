"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileText, FolderOpen, Loader2, Paperclip, Plus, Search, UploadCloud, X } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { useUpload } from "@/components/shared/use-upload";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiPost } from "@/lib/api";

type RecordItem = {
  id: string;
  recordNo: string;
  type: string;
  title: string;
  summary: string | null;
  files: string | null;
  createdAt: string;
  patient: { id: string; patientNo: string; firstName: string; lastName: string };
  doctor: { user: { title: string | null; firstName: string; lastName: string } } | null;
};

type UploadedFile = { name: string; url: string };

type PatientOption = { id: string; patientNo: string; firstName: string; lastName: string };
type DoctorOption = { id: string; user: { title: string | null; firstName: string; lastName: string } };

const TYPE_META: Record<string, { label: string; cls: string }> = {
  PRESCRIPTION: { label: "Prescription", cls: "bg-teal-500/10 text-teal-700 dark:text-teal-300" },
  DIAGNOSIS: { label: "Diagnosis", cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  LAB: { label: "Lab", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  RADIOLOGY: { label: "Radiology", cls: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  ADMISSION: { label: "Admission", cls: "bg-teal-600/10 text-teal-700 dark:text-teal-300" },
  OPD: { label: "OPD", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  GENERAL: { label: "General", cls: "bg-muted text-muted-foreground" },
};

const TABS = ["ALL", "PRESCRIPTION", "DIAGNOSIS", "LAB", "RADIOLOGY", "ADMISSION", "OPD", "GENERAL"];

export function RecordsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState("ALL");
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["records", tab, debounced],
    queryFn: () =>
      apiGet<{ items: RecordItem[]; total: number }>("/records", {
        type: tab === "ALL" ? undefined : tab,
        q: debounced || undefined,
      }),
  });

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Medical Records"
        description="Patient chart across departments"
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New record
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total records" icon={FolderOpen} value={data?.total ?? items.length} loading={isLoading} />
        <StatCard label="Prescriptions" icon={FileText} value={items.filter((r) => r.type === "PRESCRIPTION").length} loading={isLoading} />
        <StatCard label="Lab reports" icon={FileText} value={items.filter((r) => r.type === "LAB").length} loading={isLoading} />
        <StatCard label="Radiology" icon={FileText} value={items.filter((r) => r.type === "RADIOLOGY").length} loading={isLoading} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {t === "ALL" ? "All" : TYPE_META[t]?.label ?? t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search records or patients…" className="h-9 w-64 pl-8" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">No records found.</div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm">
          {items.map((r) => {
            const meta = TYPE_META[r.type] ?? TYPE_META.GENERAL;
            return (
              <div key={r.id} className="flex items-start gap-4 border-b px-5 py-4 last:border-0">
                <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.cls}`}>
                  <FileText className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    <Badge variant="secondary" className="text-[10px]">{r.recordNo}</Badge>
                    <Badge className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                  </div>
                  {r.summary && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.patient.firstName} {r.patient.lastName} · {r.patient.patientNo}
                    {r.doctor ? ` · Dr. ${r.doctor.user.firstName} ${r.doctor.user.lastName}` : ""}
                    {" · "}{format(new Date(r.createdAt), "MMM d, yyyy")}
                  </p>
                  {(() => {
                    const files: UploadedFile[] = r.files ? JSON.parse(r.files) : [];
                    if (files.length === 0) return null;
                    return (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {files.map((f) => (
                          <a
                            key={f.url}
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                          >
                            <Paperclip className="size-3" /> {f.name}
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <CreateRecordDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: ["records"] });
          }}
        />
      )}
    </div>
  );
}

function CreateRecordDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [patientId, setPatientId] = React.useState("");
  const [type, setType] = React.useState("GENERAL");
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [doctorId, setDoctorId] = React.useState("");
  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const { openPicker, picker } = useUpload("record", (file) => {
    setFiles((prev) => (prev.length >= 10 ? prev : [...prev, file]));
  });

  const { data: patients } = useQuery({
    queryKey: ["record-patients"],
    queryFn: () => apiGet<{ items: PatientOption[] }>("/patients?pageSize=50"),
  });
  const { data: doctors } = useQuery({
    queryKey: ["record-doctors"],
    queryFn: () => apiGet<{ items: DoctorOption[] }>("/doctors"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      apiPost("/records", {
        patientId,
        type,
        title: title.trim(),
        summary: summary.trim() || undefined,
        doctorId: doctorId || undefined,
        files: files.length > 0 ? files : undefined,
      }),
    onSuccess: () => {
      toast.success("Record created");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create record"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New medical record</DialogTitle>
          <DialogDescription>Add an entry to a patient&apos;s chart.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TABS.filter((t) => t !== "ALL").map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_META[t]?.label ?? t}</SelectItem>
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
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chest X-ray report" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Summary</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Attachments</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={files.length >= 10}>
                {picker}<UploadCloud className="size-4" /> Upload file
              </Button>
              {files.map((f) => (
                <span key={f.url} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                  <Paperclip className="size-3" />
                  <span className="max-w-40 truncate">{f.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles((prev) => prev.filter((x) => x.url !== f.url))}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Images or PDFs, max 5 MB each (Cloudinary).</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!patientId || title.trim().length < 2 || createMut.isPending}>
            {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
