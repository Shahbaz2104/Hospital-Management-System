"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Loader2, Plus, Trash2, CalendarClock, CalendarCheck2, Clock3 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AppointmentCalendar } from "@/components/features/appointments/appointment-calendar";
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

type PatientOption = { id: string; patientNo: string; firstName: string; lastName: string };
type DoctorOption = {
  id: string;
  available: boolean;
  user: { firstName: string; lastName: string; title: string | null };
};
type AppointmentRow = {
  id: string;
  tokenNo: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
  reason: string | null;
  patient: {
    id: string;
    patientNo: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  doctor: {
    user: { firstName: string; lastName: string; title: string | null };
  } | null;
  department: { name: string } | null;
};

const appointmentFormSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  doctorId: z.string().optional(),
  date: z.string().min(1, "Pick a date"),
  startTime: z.string().min(1, "Start time"),
  endTime: z.string().min(1, "End time"),
  type: z.enum(["WALKIN", "ONLINE", "FOLLOWUP"]).default("WALKIN"),
  reason: z.string().trim().max(300).optional(),
});

const STATUS_META: Record<string, { label: string; badge: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  PENDING: { label: "Pending", badge: "secondary" },
  CONFIRMED: { label: "Confirmed", badge: "default", className: "bg-primary" },
  COMPLETED: { label: "Completed", badge: "outline" },
  CANCELLED: { label: "Cancelled", badge: "destructive" },
  MISSED: { label: "Missed", badge: "destructive" },
};

const TYPE_LABELS: Record<string, string> = {
  WALKIN: "Walk-in",
  ONLINE: "Online",
  FOLLOWUP: "Follow-up",
};

const todayISO = format(new Date(), "yyyy-MM-dd");

export function AppointmentsPage() {
  const [open, setOpen] = React.useState(false);
  const [day, setDay] = React.useState(todayISO);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [view, setView] = React.useState<"list" | "calendar">("list");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["appointments", day, statusFilter],
    queryFn: () =>
      apiGet<{ items: AppointmentRow[]; meta: { total: number } }>("/appointments", {
        page: 1,
        pageSize: 100,
        date: day,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      }),
  });

  const { data: calendarData, refetch: refetchCalendar } = useQuery({
    queryKey: ["appointments", "calendar"],
    queryFn: () =>
      apiGet<{ items: AppointmentRow[]; meta: { total: number } }>("/appointments", {
        page: 1,
        pageSize: 500,
      }),
    enabled: view === "calendar",
  });

  const { data: patients } = useQuery({
    queryKey: ["patients", "options"],
    queryFn: () =>
      apiGet<{ items: PatientOption[] }>("/patients", { page: 1, pageSize: 100 }),
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors", "options"],
    queryFn: () =>
      apiGet<{ items: DoctorOption[] }>("/doctors", { page: 1, pageSize: 100 }),
  });

  const form = useForm<z.input<typeof appointmentFormSchema>>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      patientId: "",
      doctorId: "",
      date: todayISO,
      startTime: "09:00",
      endTime: "09:15",
      type: "WALKIN",
      reason: "",
    },
  });

  async function onCreate(values: z.input<typeof appointmentFormSchema>) {
    try {
      await apiPost("/appointments", values);
      toast.success("Appointment booked");
      setOpen(false);
      form.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to book");
    }
  }

  async function onStatus(id: string, status: string) {
    try {
      await apiPatch(`/appointments/${id}`, { status });
      toast.success(`Marked ${STATUS_META[status].label.toLowerCase()}`);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function onDelete(id: string, tokenNo: string) {
    if (!confirm(`Delete appointment ${tokenNo}?`)) return;
    try {
      await apiDelete(`/appointments/${id}`);
      toast.success("Appointment deleted");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  }

  const items = data?.items ?? [];
  const counts = {
    CONFIRMED: items.filter((a) => a.status === "CONFIRMED").length,
    COMPLETED: items.filter((a) => a.status === "COMPLETED").length,
    CANCELLED: items.filter((a) => a.status === "CANCELLED").length,
  };

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Schedule, queue and consultation status"
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Book appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Book appointment</DialogTitle>
              <DialogDescription>
                A queue token is generated automatically.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
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
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
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
                  name="doctorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doctor</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select doctor (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {doctors?.items.map((d) => (
                              <SelectItem key={d.id} value={d.id} disabled={!d.available}>
                                {d.user.title ? `${d.user.title} ` : ""}
                                {d.user.firstName} {d.user.lastName}
                                {!d.available ? " (unavailable)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
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
                      <FormLabel>Reason</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Chest pain, follow-up" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Book
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Confirmed" icon={CalendarCheck2} value={counts.CONFIRMED} loading={isLoading} />
        <StatCard label="Completed" icon={CalendarClock} value={counts.COMPLETED} loading={isLoading} />
        <StatCard label="Cancelled" icon={Clock3} value={counts.CANCELLED} loading={isLoading} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "list" && (
          <>
            <Input
              type="date"
              className="w-auto"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="ALL">All</TabsTrigger>
                <TabsTrigger value="PENDING">Pending</TabsTrigger>
                <TabsTrigger value="CONFIRMED">Confirmed</TabsTrigger>
                <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
                <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        )}
      </div>

      {view === "calendar" ? (
        <AppointmentCalendar
          appointments={calendarData?.items ?? []}
          onChanged={() => {
            refetch();
            refetchCalendar();
          }}
        />
      ) : (
        <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center">
            <CalendarClock className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">No appointments</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(day + "T00:00:00"), "MMMM d, yyyy")} has no{" "}
              {statusFilter === "ALL" ? "" : STATUS_META[statusFilter].label.toLowerCase() + " "}
              appointments.
            </p>
          </div>
        ) : (
          items.map((a) => {
            const meta = STATUS_META[a.status] ?? STATUS_META.PENDING;
            return (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card p-4"
              >
                <div className="w-14 text-center">
                  <p className="text-lg font-semibold font-mono tabular-nums leading-none">
                    {a.startTime}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {format(new Date(a.date), "MMM d")}
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
                <div className="min-w-44 leading-tight">
                  <p className="text-sm">
                    {a.doctor
                      ? `${a.doctor.user.title ? a.doctor.user.title + " " : ""}${a.doctor.user.firstName} ${a.doctor.user.lastName}`
                      : "Unassigned"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABELS[a.type] ?? a.type}
                    {a.department ? ` · ${a.department.name}` : ""}
                  </p>
                </div>
                <Badge className={meta.className} variant={meta.badge}>
                  {meta.label}
                </Badge>
                <div className="ml-auto flex items-center gap-1.5">
                  {a.status === "PENDING" && (
                    <Button size="sm" variant="outline" onClick={() => onStatus(a.id, "CONFIRMED")}>
                      Confirm
                    </Button>
                  )}
                  {a.status === "CONFIRMED" && (
                    <Button size="sm" onClick={() => onStatus(a.id, "COMPLETED")}>
                      Complete
                    </Button>
                  )}
                  {(a.status === "PENDING" || a.status === "CONFIRMED") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onStatus(a.id, "CANCELLED")}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete appointment"
                    onClick={() => onDelete(a.id, a.tokenNo)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
        </div>
      )}
    </div>
  );
}