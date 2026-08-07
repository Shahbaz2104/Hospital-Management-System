"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BedDouble,
  CalendarClock,
  HeartPulse,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatCard } from "@/components/shared/stat-card";
import { SkeletonTableRows } from "@/components/shared/loading";
import { Stagger } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api";

type DashboardSummary = {
  stats: {
    patients: number | null;
    doctors: number | null;
    nurses: number | null;
    appointmentsToday: number | null;
    rooms: number | null;
    totalBeds: number | null;
    occupiedBeds: number | null;
    availableBeds: number | null;
  };
  upcoming: Array<{
    id: string;
    tokenNo: string;
    startTime: string;
    status: string;
    patient: { id: string; firstName: string; lastName: string; patientNo: string };
    doctor: {
      user: { title: string | null; firstName: string; lastName: string };
    } | null;
  }>;
  appointmentsTrend: Array<{ date: string; count: number }>;
  appointmentsByStatus: Array<{ status: string; count: number }>;
  beds: Array<{ status: string; count: number }>;
};

const STATUS_META: Record<string, { label: string; className: string; color: string }> = {
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-800", color: "#f59e0b" },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-100 text-blue-800", color: "#3b82f6" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-800", color: "#10b981" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground", color: "#94a3b8" },
  MISSED: { label: "Missed", className: "bg-red-100 text-red-800", color: "#ef4444" },
};

const BED_META: Record<string, { label: string; color: string }> = {
  OCCUPIED: { label: "Occupied", color: "#3b82f6" },
  AVAILABLE: { label: "Available", color: "#10b981" },
  CLEANING: { label: "Cleaning", color: "#f59e0b" },
};

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid hsl(var(--border))",
  fontSize: 12,
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.08)",
};

export function DashboardOverview() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
  });

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <HeartPulse className="size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">Could not load dashboard data</p>
          <p className="text-sm text-muted-foreground">
            Refresh to try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stats = data?.stats;
  const trend = data?.appointmentsTrend ?? [];
  const beds = data?.beds ?? [];
  const statuses = data?.appointmentsByStatus ?? [];
  const totalBeds = beds.reduce((a, b) => a + b.count, 0);
  const occupied = beds.find((b) => b.status === "OCCUPIED")?.count ?? 0;

  const cards = [
    {
      label: "Patients registered",
      value: stats?.patients,
      icon: Users,
      hint: "All time",
      href: "/patients",
      show: stats?.patients != null,
    },
    {
      label: "Appointments today",
      value: stats?.appointmentsToday,
      icon: CalendarClock,
      hint: format(new Date(), "MMMM d, yyyy"),
      href: "/appointments",
      show: stats?.appointmentsToday != null,
    },
    {
      label: "Doctors on duty",
      value: stats?.doctors,
      icon: Stethoscope,
      hint: stats?.doctors != null ? "Available now" : undefined,
      href: "/doctors",
      show: stats?.doctors != null,
    },
    {
      label: "Available beds",
      value: stats?.availableBeds,
      icon: BedDouble,
      hint:
        stats?.totalBeds != null
          ? `${stats.occupiedBeds ?? 0} of ${stats.totalBeds} occupied`
          : undefined,
      href: "/rooms",
      show: stats?.availableBeds != null,
    },
    {
      label: "Nurses on staff",
      value: stats?.nurses,
      icon: UserRound,
      hint: stats?.nurses != null ? "Active roster" : undefined,
      href: "/nurses",
      show: stats?.nurses != null,
    },
    {
      label: "Rooms",
      value: stats?.rooms,
      icon: BedDouble,
      hint: stats?.rooms != null ? "Across all floors" : undefined,
      href: "/rooms",
      show: stats?.rooms != null,
    },
  ];

  const visibleCards = cards.filter((c) => c.show);
  const totalStatuses = statuses.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6">
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-4">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))
          : visibleCards.map((card) => (
              <div key={card.label} data-stagger-item>
                <StatCard
                  label={card.label}
                  icon={card.icon}
                  value={card.value ?? undefined}
                  hint={card.hint}
                />
              </div>
            ))}
      </Stagger>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Appointments — last 7 days</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/appointments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonTableRows rows={4} />
            ) : trend.length === 0 || trend.every((t) => t.count === 0) ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <CalendarClock className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No appointment activity yet</p>
                <p className="text-sm text-muted-foreground">
                  Trends appear once appointments are booked.
                </p>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trend.map((t) => ({ ...t, label: format(new Date(t.date), "EEE") }))}
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      formatter={(value) => [`${value} appointment${value === 1 ? "" : "s"}`, "Booked"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fill="url(#trendFill)"
                      animationDuration={1000}
                      animationEasing="ease-out"
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Bed occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
              </div>
            ) : totalBeds === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <BedDouble className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No bed data yet</p>
                <p className="text-sm text-muted-foreground">
                  Rooms and beds appear here once added.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative h-48 w-full max-w-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={beds}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={88}
                        paddingAngle={3}
                        strokeWidth={0}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      >
                        {beds.map((b) => (
                          <Cell key={b.status} fill={BED_META[b.status]?.color ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [
                          `${value} bed${value === 1 ? "" : "s"}`,
                          BED_META[String(name)]?.label ?? String(name),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-3xl font-semibold tabular-nums tracking-tight">
                      {Math.round(totalBeds > 0 ? (occupied / totalBeds) * 100 : 0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {occupied} of {totalBeds} occupied
                    </p>
                  </div>
                </div>
                <div className="mt-4 w-full space-y-2">
                  {beds.map((b) => (
                    <div key={b.status} className="flex items-center gap-3 text-sm">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: BED_META[b.status]?.color ?? "#94a3b8" }}
                      />
                      <span className="flex-1 text-muted-foreground">
                        {BED_META[b.status]?.label ?? b.status}
                      </span>
                      <span className="font-semibold tabular-nums">{b.count}</span>
                      <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                        {Math.round((b.count / totalBeds) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Today&apos;s queue</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/appointments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonTableRows rows={5} />
            ) : (data?.upcoming.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <CalendarClock className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No appointments yet today</p>
                <p className="text-sm text-muted-foreground">
                  Book the first slot to start the day.
                </p>
                <Button asChild size="sm" className="mt-2">
                  <Link href="/appointments">Book appointment</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {data?.upcoming.map((a) => {
                  const meta = STATUS_META[a.status] ?? STATUS_META.PENDING;
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-4 py-3"
                    >
                      <div className="w-14 text-center">
                        <p className="font-mono text-sm font-semibold tabular-nums leading-none">
                          {a.startTime}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {a.tokenNo}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-medium">
                          {a.patient.firstName} {a.patient.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.doctor
                            ? `${a.doctor.user.title ? a.doctor.user.title + " " : ""}${a.doctor.user.firstName} ${a.doctor.user.lastName}`
                            : "Unassigned"}
                        </p>
                      </div>
                      <Badge variant="secondary" className={meta.className}>
                        {meta.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Appointments today by status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
              </div>
            ) : totalStatuses === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <CalendarClock className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No activity today</p>
                <p className="text-sm text-muted-foreground">
                  Status breakdown appears as appointments move through the day.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    {statuses.map((s) => {
                      const pct = (s.count / totalStatuses) * 100;
                      return (
                        <motion.div
                          key={s.status}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                          style={{ background: STATUS_META[s.status]?.color ?? "#94a3b8" }}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {totalStatuses} appointment{totalStatuses === 1 ? "" : "s"} today
                  </p>
                </div>
                <div className="space-y-2.5">
                  {statuses.map((s) => {
                    const meta = STATUS_META[s.status] ?? STATUS_META.PENDING;
                    return (
                      <div key={s.status} className="flex items-center gap-3 text-sm">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: meta.color }}
                        />
                        <span className="flex-1 text-muted-foreground">{meta.label}</span>
                        <span className="font-semibold tabular-nums">{s.count}</span>
                        <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                          {Math.round((s.count / totalStatuses) * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
