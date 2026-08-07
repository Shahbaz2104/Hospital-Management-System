"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  ShieldPlus,
  XCircle,
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
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { insuranceCompanySchema, insurancePolicySchema } from "@/validators/billing";

type Company = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  coveragePercent: number;
  claimPhone: string | null;
  notes: string | null;
  active: boolean;
};

type Policy = {
  id: string;
  policyNumber: string;
  coveragePercent: number;
  status: string;
  validFrom: string | null;
  validTo: string | null;
  notes: string | null;
  patient: { id: string; patientNo: string; firstName: string; lastName: string };
  company: { id: string; name: string; coveragePercent: number };
};

type Claim = {
  id: string;
  claimNo: string;
  amount: number;
  status: string;
  claimRef: string | null;
  notes: string | null;
  createdAt: string;
  decidedAt: string | null;
  invoice: { id: string; invoiceNo: string; total: number; insuranceCoverage: number };
  policy: {
    policyNumber: string;
    company: { name: string };
    patient: { id: string; patientNo: string; firstName: string; lastName: string };
  };
  submittedBy: { firstName: string; lastName: string } | null;
  decisionBy: { firstName: string; lastName: string } | null;
};

const money = (n: number) => `$${n.toFixed(2)}`;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  EXPIRED: { label: "Expired", cls: "bg-slate-500/10 text-slate-500 dark:text-slate-400" },
  CANCELLED: { label: "Cancelled", cls: "bg-destructive/10 text-destructive" },
  SUBMITTED: { label: "Submitted", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  PAID: { label: "Paid", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  REJECTED: { label: "Rejected", cls: "bg-destructive/10 text-destructive" },
};

function badge(status: string) {
  return STATUS_BADGE[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
}

export function InsurancePage() {
  const [tab, setTab] = React.useState("companies");
  const queryClient = useQueryClient();

  const { data: companies, isLoading: loadingCompanies } = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: () => apiGet<{ items: Company[] }>("/billing/companies"),
  });

  const { data: policies, isLoading: loadingPolicies } = useQuery({
    queryKey: ["insurance-policies"],
    queryFn: () => apiGet<{ items: Policy[] }>("/billing/policies"),
  });

  const { data: claims, isLoading: loadingClaims } = useQuery({
    queryKey: ["insurance-claims"],
    queryFn: () => apiGet<{ items: Claim[] }>("/billing/claims"),
  });

  const companyList = companies?.items ?? [];
  const policyList = policies?.items ?? [];
  const claimList = claims?.items ?? [];

  const activePolicies = policyList.filter((p) => p.status === "ACTIVE").length;
  const submittedClaims = claimList.filter((c) => c.status === "SUBMITTED").length;
  const approvedValue = claimList.filter((c) => c.status === "PAID").reduce((s, c) => s + c.amount, 0);

  return (
    <div>
      <PageHeader
        title="Insurance"
        description="Insurers, patient policies and claims"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Insurance companies" icon={Building2} value={companyList.length} loading={loadingCompanies} />
        <StatCard label="Active policies" icon={ShieldPlus} value={activePolicies} loading={loadingPolicies} />
        <StatCard label="Claims awaiting decision" icon={FileText} value={submittedClaims} loading={loadingClaims} />
      </div>

      <div className="mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
            <TabsTrigger value="claims">Claims</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "companies" && (
        <CompaniesTab
          companies={companyList}
          loading={loadingCompanies}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["insurance-companies"] })}
        />
      )}
      {tab === "policies" && (
        <PoliciesTab
          policies={policyList}
          loading={loadingPolicies}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["insurance-policies"] });
            queryClient.invalidateQueries({ queryKey: ["insurance-companies"] });
          }}
        />
      )}
      {tab === "claims" && (
        <ClaimsTab
          claims={claimList}
          loading={loadingClaims}
          approvedValue={approvedValue}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["insurance-claims"] });
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

function CompaniesTab({
  companies,
  loading,
  onSaved,
}: {
  companies: Company[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Company | null>(null);

  const form = useForm<z.input<typeof insuranceCompanySchema>>({
    resolver: zodResolver(insuranceCompanySchema),
    defaultValues: { name: "", phone: "", email: "", address: "", coveragePercent: 80, claimPhone: "", notes: "", active: true },
  });
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open && editing) {
      form.reset({
        name: editing.name,
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        address: editing.address ?? "",
        coveragePercent: editing.coveragePercent,
        claimPhone: editing.claimPhone ?? "",
        notes: editing.notes ?? "",
        active: editing.active,
      });
    } else if (open) {
      form.reset({ name: "", phone: "", email: "", address: "", coveragePercent: 80, claimPhone: "", notes: "", active: true });
    }
  }, [open, editing, form]);

  async function onSave(values: z.input<typeof insuranceCompanySchema>) {
    setPending(true);
    try {
      if (editing) {
        await apiPatch(`/billing/companies/${editing.id}`, values);
        toast.success("Company updated");
      } else {
        await apiPost("/billing/companies", values);
        toast.success("Company created");
      }
      setOpen(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save company");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">Insurers</p>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus /> Add company
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : companies.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">No insurance companies yet.</p>
      ) : (
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Coverage</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{c.code}</span>
                </td>
                <td className="px-4 py-3 font-medium tabular-nums">{c.coveragePercent}%</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge className={badge(c.active ? "ACTIVE" : "CANCELLED").cls}>
                    {c.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(c); setOpen(true); }}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit company" : "Add insurance company"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update insurer details." : "Register an insurer patients can hold policies with."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company name</FormLabel>
                      <FormControl><Input placeholder="e.g. HealthGuard Insurance" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="coveragePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coverage %</FormLabel>
                      <FormControl><Input type="number" min={0} max={100} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder="+1 555 0100" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="claimPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Claims phone</FormLabel>
                      <FormControl><Input placeholder="+1 555 0199" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input placeholder="claims@insurer.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl><Input placeholder="Street, city" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  {editing ? "Save changes" : "Create company"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

type PatientOption = { id: string; patientNo: string; firstName: string; lastName: string };

function PoliciesTab({
  policies,
  loading,
  onSaved,
}: {
  policies: Policy[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const { data: patients } = useQuery({
    queryKey: ["patients", "options"],
    queryFn: () => apiGet<{ items: PatientOption[] }>("/patients", { page: 1, pageSize: 100 }),
  });
  const { data: companies } = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: () => apiGet<{ items: Company[] }>("/billing/companies"),
  });

  const activeCompanies = (companies?.items ?? []).filter((c) => c.active);

  const form = useForm({
    resolver: zodResolver(insurancePolicySchema),
    defaultValues: {
      patientId: "",
      companyId: "",
      policyNumber: "",
      coveragePercent: 80,
      validFrom: "",
      validTo: "",
      notes: "",
    },
  });
  const companyId = form.watch("companyId");
  const selectedCompany = activeCompanies.find((c) => c.id === companyId);

  React.useEffect(() => {
    if (selectedCompany) {
      form.setValue("coveragePercent", selectedCompany.coveragePercent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedCompany]);

  React.useEffect(() => {
    if (open) {
      form.reset({
        patientId: "",
        companyId: "",
        policyNumber: "",
        coveragePercent: 80,
        validFrom: "",
        validTo: "",
        notes: "",
      });
    }
  }, [open, form]);

  async function onSave(values: { [key: string]: unknown }) {
    setPending(true);
    try {
      await apiPost("/billing/policies", {
        ...values,
        policyNumber: values.policyNumber ? String(values.policyNumber) : undefined,
        validFrom: values.validFrom ? String(values.validFrom) : undefined,
        validTo: values.validTo ? String(values.validTo) : undefined,
      });
      toast.success("Policy created");
      setOpen(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create policy");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">Patient policies</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Add policy
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : policies.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">No policies yet. Add one to cover a patient.</p>
      ) : (
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">Policy</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Coverage</th>
              <th className="px-4 py-3">Valid</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium tabular-nums">{p.policyNumber}</td>
                <td className="px-4 py-3">
                  <span>{p.patient.firstName} {p.patient.lastName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.patient.patientNo}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.company.name}</td>
                <td className="px-4 py-3 font-medium tabular-nums">{p.coveragePercent}%</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {p.validFrom ? format(new Date(p.validFrom), "MMM d, yyyy") : "—"}
                  {" → "}
                  {p.validTo ? format(new Date(p.validTo), "MMM d, yyyy") : "∞"}
                </td>
                <td className="px-4 py-3">
                  <Badge className={badge(p.status).cls}>{badge(p.status).label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add insurance policy</DialogTitle>
            <DialogDescription>Link a patient to an insurer and coverage level.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(patients?.items ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.firstName} {p.lastName} · {p.patientNo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insurance company</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeCompanies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name} ({c.coveragePercent}%)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="policyNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Policy number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Auto-generated if empty"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                        />
                      </FormControl>                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="coveragePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coverage %</FormLabel>
                      <FormControl><Input type="number" min={0} max={100} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid from</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid to</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  Create policy
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

function ClaimsTab({
  claims,
  loading,
  approvedValue,
  onSaved,
}: {
  claims: Claim[];
  loading: boolean;
  approvedValue: number;
  onSaved: () => void;
}) {
  const [deciding, setDeciding] = React.useState<string | null>(null);

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    setDeciding(id);
    try {
      await apiPatch(`/billing/claims/${id}`, { status });
      toast.success(status === "APPROVED" ? "Claim approved — payout recorded" : "Claim rejected");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update claim");
    } finally {
      setDeciding(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Submitted" icon={FileText} value={claims.filter((c) => c.status === "SUBMITTED").length} loading={loading} />
        <StatCard label="Approved payouts" icon={CheckCircle2} value={approvedValue} loading={loading} />
        <StatCard label="Rejected" icon={XCircle} value={claims.filter((c) => c.status === "REJECTED").length} loading={loading} />
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : claims.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No claims yet. Submit claims from the billing module.</p>
        ) : (
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">Claim</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium tabular-nums">{c.claimNo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {format(new Date(c.createdAt), "MMM d, yyyy")}
                      {c.decidedAt ? ` · decided ${format(new Date(c.decidedAt), "MMM d, yyyy")}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">{c.invoice.invoiceNo}</td>
                  <td className="px-4 py-3">
                    <span>{c.policy.patient.firstName} {c.policy.patient.lastName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{c.policy.patient.patientNo}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.policy.company.name}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{money(c.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge className={badge(c.status).cls}>{badge(c.status).label}</Badge>
                    {c.status === "SUBMITTED" && (
                      <span className="block pt-1 text-xs text-muted-foreground">
                        by {c.submittedBy ? `${c.submittedBy.firstName} ${c.submittedBy.lastName}` : "—"}
                      </span>
                    )}
                    {c.status !== "SUBMITTED" && c.decisionBy && (
                      <span className="block pt-1 text-xs text-muted-foreground">
                        by {c.decisionBy.firstName} {c.decisionBy.lastName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === "SUBMITTED" ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deciding === c.id}
                          onClick={() => decide(c.id, "REJECTED")}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={deciding === c.id}
                          onClick={() => decide(c.id, "APPROVED")}
                        >
                          {deciding === c.id && <Loader2 className="animate-spin" />}
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <span className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                        <ShieldCheck className="size-3.5" />
                        {c.status === "PAID" ? "Payout recorded" : "Claim closed"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
