"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
  UserRound,
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
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";
import {
  employeeSchema,
  leaveSchema,
  performanceReviewSchema,
} from "@/validators/hr";

type Employee = {
  id: string;
  employeeNo: string;
  designation: string | null;
  employmentType: string;
  joiningDate: string | null;
  salary: number;
  allowances: number;
  status: string;
  gender: string | null;
  birthDate: string | null;
  address: string | null;
  emergencyContact: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: { name: string; label: string };
  };
  department: { id: string; name: string; code: string } | null;
};

type AttendanceRecord = {
  id: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number | null;
  notes: string | null;
  employee: {
    user: { firstName: string; lastName: string; phone: string | null };
    department: { name: string } | null;
  };
};

type AttendanceStat = {
  employeeId: string;
  employeeNo: string;
  name: string;
  department: string | null;
  PRESENT: number;
  ABSENT: number;
  HALF_DAY: number;
  LEAVE: number;
};

type Leave = {
  id: string;
  leaveNo: string;
  type: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: string;
  notes: string | null;
  decidedAt: string | null;
  employee: {
    user: { firstName: string; lastName: string };
    department: { name: string } | null;
  };
  approver: { firstName: string; lastName: string } | null;
};

type Review = {
  id: string;
  period: string;
  rating: number;
  strengths: string | null;
  improvements: string | null;
  goals: string | null;
  createdAt: string;
  employee: { user: { firstName: string; lastName: string } };
  reviewer: { firstName: string; lastName: string } | null;
};

type Role = { id: string; name: string; label: string };
type Department = { id: string; name: string; code: string };

const money = (n: number) => `$${n.toFixed(2)}`;

const BADGES: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  INACTIVE: { label: "Inactive", cls: "bg-slate-500/10 text-slate-500 dark:text-slate-400 dark:text-slate-400" },
  ON_LEAVE: { label: "On leave", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  TERMINATED: { label: "Terminated", cls: "bg-destructive/10 text-destructive" },
  PRESENT: { label: "Present", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  ABSENT: { label: "Absent", cls: "bg-destructive/10 text-destructive" },
  HALF_DAY: { label: "Half day", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  LEAVE: { label: "Leave", cls: "bg-teal-500/10 text-teal-700 dark:text-teal-300" },
  PENDING: { label: "Pending", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  APPROVED: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  REJECTED: { label: "Rejected", cls: "bg-destructive/10 text-destructive" },
};

function badge(status: string) {
  return BADGES[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  ANNUAL: "Annual",
  UNPAID: "Unpaid",
  MATERNITY: "Maternity",
  PATERNITY: "Paternity",
  OTHER: "Other",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERN: "Intern",
};

export function HrPage() {
  const [tab, setTab] = React.useState("employees");
  const queryClient = useQueryClient();

  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: () => apiGet<{ items: Employee[] }>("/hr/employees", { pageSize: 200 }),
  });
  const { data: leaves, isLoading: loadingLeaves } = useQuery({
    queryKey: ["hr-leaves"],
    queryFn: () => apiGet<{ items: Leave[] }>("/hr/leaves"),
  });
  const { data: reviews, isLoading: loadingReviews } = useQuery({
    queryKey: ["hr-reviews"],
    queryFn: () => apiGet<{ items: Review[] }>("/hr/reviews"),
  });

  const employeeList = employees?.items ?? [];
  const leaveList = leaves?.items ?? [];
  const reviewList = reviews?.items ?? [];

  const activeCount = employeeList.filter((e) => e.status === "ACTIVE").length;
  const onLeaveCount = employeeList.filter((e) => e.status === "ON_LEAVE").length;
  const pendingLeaves = leaveList.filter((l) => l.status === "PENDING").length;

  return (
    <div>
      <PageHeader title="HR" description="Employees, attendance, leave and performance" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total employees" icon={UserRound} value={employeeList.length} loading={loadingEmployees} />
        <StatCard label="Active" icon={BadgeCheck} value={activeCount} loading={loadingEmployees} />
        <StatCard label="On leave" icon={CalendarCheck2} value={onLeaveCount} loading={loadingEmployees} />
        <StatCard label="Pending leave requests" icon={FileText} value={pendingLeaves} loading={loadingLeaves} />
      </div>

      <div className="mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leaves">Leaves</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "employees" && (
        <EmployeesTab
          employees={employeeList}
          loading={loadingEmployees}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["hr-employees"] })}
        />
      )}
      {tab === "attendance" && (
        <AttendanceTab
          employees={employeeList}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
            queryClient.invalidateQueries({ queryKey: ["hr-attendance-stats"] });
          }}
        />
      )}
      {tab === "leaves" && (
        <LeavesTab
          employees={employeeList}
          leaves={leaveList}
          loading={loadingLeaves}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["hr-leaves"] })}
        />
      )}
      {tab === "reviews" && (
        <ReviewsTab
          employees={employeeList}
          reviews={reviewList}
          loading={loadingReviews}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["hr-reviews"] })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

function EmployeesTab({
  employees,
  loading,
  onSaved,
}: {
  employees: Employee[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Employee | null>(null);
  const [pending, setPending] = React.useState(false);

  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: () => apiGet<{ items: Role[] }>("/roles") });
  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => apiGet<{ items: Department[] }>("/departments", { pageSize: 100 }) });

  const roleOptions = (roles?.items ?? []).filter((r) => r.name !== "SUPER_ADMIN" && r.name !== "PATIENT");
  const deptOptions = departments?.items ?? [];

  const form = useForm<z.input<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      roleName: "",
      departmentId: "",
      designation: "",
      employmentType: "FULL_TIME",
      joiningDate: "",
      salary: 0,
      allowances: 0,
      gender: "",
      birthDate: "",
      address: "",
      emergencyContact: "",
      bankName: "",
      bankAccountNo: "",
      bankIfsc: "",
      status: "ACTIVE",
    },
  });

  React.useEffect(() => {
    if (open && editing) {
      form.reset({
        firstName: editing.user.firstName,
        lastName: editing.user.lastName,
        email: editing.user.email,
        password: "",
        phone: editing.user.phone ?? "",
        roleName: editing.user.role.name,
        departmentId: editing.department?.id ?? "",
        designation: editing.designation ?? "",
        employmentType: editing.employmentType as z.input<typeof employeeSchema>["employmentType"],
        joiningDate: editing.joiningDate ? editing.joiningDate.slice(0, 10) : "",
        salary: editing.salary,
        allowances: editing.allowances,
        gender: editing.gender ?? "",
        birthDate: editing.birthDate ? editing.birthDate.slice(0, 10) : "",
        address: editing.address ?? "",
        emergencyContact: editing.emergencyContact ?? "",
        bankName: editing.bankName ?? "",
        bankAccountNo: editing.bankAccountNo ?? "",
        bankIfsc: editing.bankIfsc ?? "",
        status: editing.status as z.input<typeof employeeSchema>["status"],
      });
    } else if (open) {
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        phone: "",
        roleName: roleOptions[0]?.name ?? "ACCOUNTANT",
        departmentId: "",
        designation: "",
        employmentType: "FULL_TIME",
        joiningDate: "",
        salary: 0,
        allowances: 0,
        gender: "",
        birthDate: "",
        address: "",
        emergencyContact: "",
        bankName: "",
        bankAccountNo: "",
        bankIfsc: "",
        status: "ACTIVE",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, form]);

  async function onSave(values: z.input<typeof employeeSchema>) {
    setPending(true);
    try {
      const payload = { ...values, password: values.password?.trim() ? values.password : undefined };
      if (editing) {
        await apiPatch(`/hr/employees/${editing.id}`, payload);
        toast.success("Employee updated");
      } else {
        await apiPost("/hr/employees", payload);
        toast.success("Employee created");
      }
      setOpen(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save employee");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(employee: Employee) {
    const name = `${employee.user.firstName} ${employee.user.lastName}`;
    if (!confirm(`Delete ${name}? The linked user account is removed too.`)) return;
    try {
      await apiDelete(`/hr/employees/${employee.id}`);
      toast.success("Employee deleted");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete employee");
    }
  }

  const filtered = employees.filter(
    (e) =>
      (status === "ALL" || e.status === status) &&
      (search === "" ||
        `${e.user.firstName} ${e.user.lastName} ${e.employeeNo} ${e.designation ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()))
  );

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees…"
              className="h-9 w-56 pl-8"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ON_LEAVE">On leave</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="TERMINATED">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus /> Add employee
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">No employees found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>No.</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Type</th>
                <th className="text-right">Monthly salary</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const b = badge(e.status);
                return (
                  <tr key={e.id}>
                    <td>
                      <p className="font-medium">{e.user.firstName} {e.user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{e.user.email}</p>
                    </td>
                    <td className="font-mono text-xs">{e.employeeNo}</td>
                    <td>{e.designation ?? "—"}</td>
                    <td>{e.department?.name ?? "—"}</td>
                    <td>{EMPLOYMENT_LABELS[e.employmentType] ?? e.employmentType}</td>
                    <td className="text-right tabular-nums">{money(e.salary + e.allowances)}</td>
                    <td><Badge className={b.cls}>{b.label}</Badge></td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(e)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update profile, role and compensation details."
                : "Create a user account and employee record. A password is required."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First name</FormLabel><FormControl><Input placeholder="Ayesha" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last name</FormLabel><FormControl><Input placeholder="Rahman" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="name@hospital.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{editing ? "New password (optional)" : "Password"}</FormLabel>
                    <FormControl><Input type="password" placeholder="Min 8 characters" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="roleName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {roleOptions.map((r) => <SelectItem key={r.name} value={r.name}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="departmentId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {deptOptions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="designation" render={({ field }) => (
                  <FormItem><FormLabel>Designation</FormLabel><FormControl><Input placeholder="Senior Accountant" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="employmentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="salary" render={({ field }) => (
                  <FormItem><FormLabel>Basic salary ($/month)</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="allowances" render={({ field }) => (
                  <FormItem><FormLabel>Allowances ($/month)</FormLabel><FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="ON_LEAVE">On leave</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="TERMINATED">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="joiningDate" render={({ field }) => (
                  <FormItem><FormLabel>Joining date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                  <FormItem><FormLabel>Date of birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="+1 555 010 1234" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="emergencyContact" render={({ field }) => (
                  <FormItem><FormLabel>Emergency contact</FormLabel><FormControl><Input placeholder="+1 555 010 9999" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel><FormControl><Input placeholder="Home address" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="bankName" render={({ field }) => (
                  <FormItem><FormLabel>Bank name</FormLabel><FormControl><Input placeholder="First National Bank" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="bankAccountNo" render={({ field }) => (
                  <FormItem><FormLabel>Account no.</FormLabel><FormControl><Input placeholder="•••• 1234" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="bankIfsc" render={({ field }) => (
                  <FormItem><FormLabel>Routing / IFSC</FormLabel><FormControl><Input placeholder="FNBL0001234" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save changes" : "Create employee"}
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
// Attendance
// ---------------------------------------------------------------------------

function AttendanceTab({
  employees,
  onSaved,
}: {
  employees: Employee[];
  onSaved: () => void;
}) {
  const [month, setMonth] = React.useState(new Date().toISOString().slice(0, 7));
  const [pending, setPending] = React.useState(false);

  const { data: records, isLoading: loadingRecords, refetch: refetchRecords } = useQuery({
    queryKey: ["hr-attendance", month],
    queryFn: () => apiGet<{ items: AttendanceRecord[] }>("/hr/attendance", { month }),
  });
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["hr-attendance-stats", month],
    queryFn: () => apiGet<AttendanceStat[]>("/hr/attendance/stats", { month }),
  });

  const [employeeId, setEmployeeId] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = React.useState("PRESENT");
  const [allEmployees, setAllEmployees] = React.useState(false);
  const [checkIn, setCheckIn] = React.useState("09:00");
  const [checkOut, setCheckOut] = React.useState("17:00");

  const recordList = records?.items ?? [];
  const statList = stats ?? [];

  async function submitMark() {
    if (!date) return toast.error("Pick a date");
    const entries = allEmployees
      ? employees.map((e) => ({ employeeId: e.id, date, status, checkIn, checkOut }))
      : [{ employeeId, date, status, checkIn, checkOut }];
    if (!entries.length) return toast.error("No employees to mark");

    setPending(true);
    try {
      await apiPost("/hr/attendance", { entries });
      toast.success(`Attendance marked for ${entries.length} employee${entries.length === 1 ? "" : "s"}`);
      onSaved();
      refetchRecords();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark attendance");
    } finally {
      setPending(false);
    }
  }

  const todayCount = recordList.filter((r) => r.date === date).length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <p className="text-sm font-medium">Mark attendance</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
                <SelectItem value="HALF_DAY">Half day</SelectItem>
                <SelectItem value="LEAVE">Leave</SelectItem>
              </SelectContent>
            </Select>
            {!allEmployees && (
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="h-9 w-52"><SelectValue placeholder="Employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.user.firstName} {e.user.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" onClick={() => setAllEmployees((v) => !v)}>
              {allEmployees ? "One employee" : "All employees"}
            </Button>
            <Button size="sm" onClick={submitMark} disabled={pending || (!allEmployees && !employeeId)}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Mark {allEmployees ? "all" : "employee"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm text-muted-foreground">
          <span>Optional clock-in/out:</span>
          <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="h-8 w-28" />
          <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="h-8 w-28" />
          <span className="ml-auto">{todayCount} record{todayCount === 1 ? "" : "s"} for this date</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <p className="text-sm font-medium">Monthly summary</p>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-40" />
          </div>
          {loadingStats ? (
            <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : statList.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No attendance for {month}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th className="text-center">Present</th>
                    <th className="text-center">Absent</th>
                    <th className="text-center">Half day</th>
                    <th className="text-center">Leave</th>
                  </tr>
                </thead>
                <tbody>
                  {statList.map((s) => (
                    <tr key={s.employeeId}>
                      <td>
                        <p className="font-medium">{s.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{s.employeeNo}{s.department ? ` · ${s.department}` : ""}</p>
                      </td>
                      <td className="text-center tabular-nums text-emerald-600 dark:text-emerald-400">{s.PRESENT}</td>
                      <td className="text-center tabular-nums text-destructive">{s.ABSENT}</td>
                      <td className="text-center tabular-nums text-amber-600 dark:text-amber-400">{s.HALF_DAY}</td>
                      <td className="text-center tabular-nums text-teal-600 dark:text-teal-400">{s.LEAVE}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium">Records — {month}</p>
          </div>
          {loadingRecords ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : recordList.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No records yet.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Status</th>
                    <th>In → Out</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {recordList.map((r) => {
                    const b = badge(r.status);
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap font-mono text-xs">{r.date}</td>
                        <td>
                          <p className="font-medium">{r.employee.user.firstName} {r.employee.user.lastName}</p>
                          <p className="text-xs text-muted-foreground">{r.employee.department?.name ?? "—"}</p>
                        </td>
                        <td><Badge className={b.cls}>{b.label}</Badge></td>
                        <td className="whitespace-nowrap font-mono text-xs">
                          {r.checkIn || "—"} → {r.checkOut || "—"}
                        </td>
                        <td className="tabular-nums">{r.hoursWorked != null ? `${r.hoursWorked}h` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------

function LeavesTab({
  employees,
  leaves,
  loading,
  onSaved,
}: {
  employees: Employee[];
  leaves: Leave[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [status, setStatus] = React.useState("ALL");
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [decidingId, setDecidingId] = React.useState<string | null>(null);

  const form = useForm<z.input<typeof leaveSchema>>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      employeeId: "",
      type: "CASUAL",
      fromDate: "",
      toDate: "",
      reason: "",
      notes: "",
    },
  });

  async function onSave(values: z.input<typeof leaveSchema>) {
    setPending(true);
    try {
      await apiPost("/hr/leaves", values);
      toast.success("Leave request created");
      setOpen(false);
      form.reset();
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create leave");
    } finally {
      setPending(false);
    }
  }

  async function decide(leave: Leave, decision: "APPROVED" | "REJECTED") {
    setDecidingId(leave.id);
    try {
      await apiPatch(`/hr/leaves/${leave.id}`, { status: decision });
      toast.success(`Leave ${decision.toLowerCase()}`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update leave");
    } finally {
      setDecidingId(null);
    }
  }

  const filtered = leaves.filter(
    (l) =>
      (status === "ALL" || l.status === status) &&
      (search === "" ||
        `${l.leaveNo} ${l.employee.user.firstName} ${l.employee.user.lastName}`
          .toLowerCase()
          .includes(search.toLowerCase()))
  );

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leaves…" className="h-9 w-56 pl-8" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Request leave
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">No leave requests found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const b = badge(l.status);
                return (
                  <tr key={l.id}>
                    <td className="font-mono text-xs">{l.leaveNo}</td>
                    <td>
                      <p className="font-medium">{l.employee.user.firstName} {l.employee.user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{l.employee.department?.name ?? "—"}</p>
                    </td>
                    <td>{LEAVE_TYPE_LABELS[l.type] ?? l.type}</td>
                    <td className="whitespace-nowrap font-mono text-xs">
                      {format(new Date(l.fromDate), "MMM d")} → {format(new Date(l.toDate), "MMM d, yyyy")}
                    </td>
                    <td className="tabular-nums">{l.days}</td>
                    <td className="max-w-52 truncate">{l.reason}</td>
                    <td><Badge className={b.cls}>{b.label}</Badge></td>
                    <td className="text-right">
                      {l.status === "PENDING" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="text-emerald-600" disabled={decidingId === l.id} onClick={() => decide(l, "APPROVED")}>
                            <CheckCircle2 className="size-4" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" disabled={decidingId === l.id} onClick={() => decide(l, "REJECTED")}>
                            <XCircle className="size-4" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {l.decidedAt ? format(new Date(l.decidedAt), "MMM d, yyyy") : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription>Submit a leave request for an employee.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="employeeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.user.firstName} {e.user.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="fromDate" render={({ field }) => (
                  <FormItem><FormLabel>From</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="toDate" render={({ field }) => (
                  <FormItem><FormLabel>To</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="reason" render={({ field }) => (
                <FormItem><FormLabel>Reason</FormLabel><FormControl><Textarea placeholder="Why is leave needed?" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Submit request
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
// Reviews
// ---------------------------------------------------------------------------

function ReviewsTab({
  employees,
  reviews,
  loading,
  onSaved,
}: {
  employees: Employee[];
  reviews: Review[];
  loading: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<z.input<typeof performanceReviewSchema>>({
    resolver: zodResolver(performanceReviewSchema),
    defaultValues: {
      employeeId: "",
      period: "",
      rating: 3,
      strengths: "",
      improvements: "",
      goals: "",
    },
  });

  async function onSave(values: z.input<typeof performanceReviewSchema>) {
    setPending(true);
    try {
      await apiPost("/hr/reviews", values);
      toast.success("Review created");
      setOpen(false);
      form.reset();
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create review");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">Performance reviews</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Add review
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : reviews.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Rating</th>
                <th>Strengths</th>
                <th>Goals</th>
                <th>Reviewer</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    <p className="font-medium">{r.employee.user.firstName} {r.employee.user.lastName}</p>
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs">{r.period}</td>
                  <td>
                    <span className="inline-flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`size-3.5 ${i < r.rating ? "fill-current" : "text-muted"}`} />
                      ))}
                      <span className="ml-1 text-xs font-semibold text-foreground">{r.rating}/5</span>
                    </span>
                  </td>
                  <td className="max-w-52 truncate">{r.strengths ?? "—"}</td>
                  <td className="max-w-40 truncate">{r.goals ?? "—"}</td>
                  <td className="text-xs text-muted-foreground">
                    {r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add performance review</DialogTitle>
            <DialogDescription>Rate an employee for a review period.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="employeeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.user.firstName} {e.user.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="period" render={({ field }) => (
                  <FormItem><FormLabel>Period</FormLabel><FormControl><Input placeholder="e.g. 2026-Q3" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="rating" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating</FormLabel>
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((r) => <SelectItem key={r} value={String(r)}>{r} — {r === 1 ? "Poor" : r === 2 ? "Fair" : r === 3 ? "Good" : r === 4 ? "Very good" : "Excellent"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="strengths" render={({ field }) => (
                <FormItem><FormLabel>Strengths</FormLabel><FormControl><Textarea placeholder="Key strengths this period" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="improvements" render={({ field }) => (
                <FormItem><FormLabel>Areas for improvement</FormLabel><FormControl><Textarea placeholder="What to work on" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="goals" render={({ field }) => (
                <FormItem><FormLabel>Goals</FormLabel><FormControl><Textarea placeholder="Goals for next period" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Save review
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
