"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BriefcaseBusiness, Mail, Phone, Search } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Employee = {
  id: string;
  employeeNo: string;
  designation: string | null;
  employmentType: string;
  joiningDate: string | null;
  status: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: { name: string; label: string };
  };
  department: { id: string; name: string; code: string } | null;
};

const BADGES: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  INACTIVE: { label: "Inactive", cls: "bg-slate-500/10 text-slate-500 dark:text-slate-400" },
  ON_LEAVE: { label: "On leave", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  TERMINATED: { label: "Terminated", cls: "bg-destructive/10 text-destructive" },
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERN: "Intern",
};

export function StaffPage() {
  const [search, setSearch] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["staff-roster"],
    queryFn: () => apiGet<{ items: Employee[] }>("/hr/employees", { pageSize: 200 }),
  });

  const employees = React.useMemo(() => data?.items ?? [], [data]);

  const grouped = React.useMemo(() => {
    const filtered = employees.filter((e) =>
      search === ""
        ? true
        : `${e.user.firstName} ${e.user.lastName} ${e.designation ?? ""} ${e.user.role.label}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );
    const map = new Map<string, Employee[]>();
    for (const e of filtered) {
      const key = e.department?.name ?? "Unassigned";
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [employees, search]);

  const active = employees.filter((e) => e.status === "ACTIVE").length;
  const departments = new Set(employees.map((e) => e.department?.name ?? "Unassigned")).size;

  return (
    <div>
      <PageHeader title="Staff" description="Hospital roster grouped by department" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total staff" icon={BriefcaseBusiness} value={employees.length} loading={isLoading} />
        <StatCard label="Active" icon={BriefcaseBusiness} value={active} loading={isLoading} />
        <StatCard label="Departments" icon={BriefcaseBusiness} value={departments} loading={isLoading} />
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the roster…" className="h-10 pl-8" />
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 shadow-sm">
              <Skeleton className="mb-4 h-5 w-40" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-24 w-full" />)}
              </div>
            </div>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">No staff found.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dept, members]) => (
            <section key={dept} className="rounded-lg border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold">{dept}</h2>
                <span className="text-xs text-muted-foreground">{members.length} member{members.length === 1 ? "" : "s"}</span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {members.map((e) => {
                  const b = BADGES[e.status] ?? { label: e.status, cls: "bg-muted text-muted-foreground" };
                  const initials = `${e.user.firstName[0] ?? ""}${e.user.lastName[0] ?? ""}`;
                  return (
                    <div key={e.id} className="card-hover rounded-lg border bg-background p-4">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                        </Avatar>
                        <Badge className={b.cls}>{b.label}</Badge>
                      </div>
                      <p className="font-medium">{e.user.firstName} {e.user.lastName}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.designation ?? e.user.role.label}{" · "}{EMPLOYMENT_LABELS[e.employmentType] ?? e.employmentType}
                      </p>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <Mail className="size-3.5" /> {e.user.email}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Phone className="size-3.5" /> {e.user.phone ?? "—"}
                        </p>
                        {e.joiningDate && (
                          <p className="text-muted-foreground">
                            Joined {format(new Date(e.joiningDate), "MMM yyyy")}
                          </p>
                        )}
                      </div>
                      <p className="mt-2 tabular-nums text-[10px] uppercase tracking-wide text-muted-foreground">
                        {e.employeeNo}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
