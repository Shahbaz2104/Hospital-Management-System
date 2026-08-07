"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BedDouble,
  CalendarClock,
  HeartPulse,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { format } from "date-fns";

import { StatCard } from "@/components/shared/stat-card";
import { SkeletonTableRows } from "@/components/shared/loading";
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
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-100 text-blue-800" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  MISSED: { label: "Missed", className: "bg-red-100 text-red-800" },
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-4">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))
          : visibleCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                icon={card.icon}
                value={card.value ?? undefined}
                hint={card.hint}
              />
            ))}
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
            <CardTitle className="text-base">Bed occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              </div>
            ) : stats?.totalBeds ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-semibold tabular-nums tracking-tight">
                      {stats.occupiedBeds}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {stats.totalBeds}
                      </span>
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(((stats.occupiedBeds ?? 0) / stats.totalBeds) * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, ((stats.occupiedBeds ?? 0) / stats.totalBeds) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Occupied beds</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-lg font-semibold tabular-nums">
                      {stats.availableBeds}
                    </p>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-lg font-semibold tabular-nums">
                      {stats.rooms}
                    </p>
                    <p className="text-xs text-muted-foreground">Rooms</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <BedDouble className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-medium">No bed data yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rooms and beds appear here once added.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}