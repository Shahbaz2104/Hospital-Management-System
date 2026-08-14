"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiPatch } from "@/lib/api";
import { cn } from "@/lib/utils";

type CalendarAppointment = {
  id: string;
  tokenNo: string;
  date: string;
  startTime: string;
  status: string;
  patient: { firstName: string; lastName: string };
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  CONFIRMED: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
  COMPLETED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  CANCELLED: "bg-red-100 text-red-800 hover:bg-red-100",
  MISSED: "bg-gray-100 text-gray-700 hover:bg-gray-100",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AppointmentCalendar({
  appointments,
  onChanged,
}: {
  appointments: CalendarAppointment[];
  onChanged: () => void;
}) {
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);

  const firstDay = startOfWeek(startOfMonth(month));
  const days = Array.from({ length: 42 }, (_, i) => addDays(firstDay, i));

  const byDate = React.useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const a of appointments) {
      const key = format(new Date(a.date), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [appointments]);

  async function onDrop(targetDate: string) {
    if (!dragging || dragging === targetDate) {
      setDragging(null);
      setOver(null);
      return;
    }
    try {
      await apiPatch(`/appointments/${dragging}`, {
        date: targetDate,
        startTime: "09:00",
        endTime: "09:15",
      });
      toast.success("Appointment moved");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Move failed");
    }
    setDragging(null);
    setOver(null);
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() => setMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(new Date())}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const list = byDate.get(key) ?? [];
          const today = isSameDay(day, new Date());
          const inMonth = isSameMonth(day, month);
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 border-b border-r p-1.5 transition-colors",
                "last:border-r-0",
                !inMonth && "bg-muted/30",
                over === key && "bg-primary/10",
                today && "bg-primary/5"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(key);
              }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(key);
              }}
            >
              <p
                className={cn(
                  "mb-1 text-right text-xs font-medium tabular-nums",
                  today ? "text-primary" : inMonth ? "text-muted-foreground" : "text-muted-foreground/40"
                )}
              >
                {format(day, "d")}
              </p>
              <div className="space-y-1">
                {list.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={() => setDragging(a.id)}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    title={`${a.tokenNo} · ${a.patient.firstName} ${a.patient.lastName}`}
                    className={cn(
                      "cursor-grab rounded px-1.5 py-0.5 text-[11px] leading-tight active:cursor-grabbing",
                      STATUS_BADGE[a.status] ?? "bg-muted"
                    )}
                  >
                    <span className="tabular-nums">{a.startTime}</span>{" "}
                    <span className="font-medium">
                      {a.patient.firstName} {a.patient.lastName}
                    </span>
                  </div>
                ))}
                {list.length > 3 && (
                  <p className="px-1 text-[11px] font-medium text-muted-foreground">
                    +{list.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2.5">
        {Object.entries(STATUS_BADGE).map(([status]) => (
          <Badge key={status} variant="outline" className={STATUS_BADGE[status]}>
            {status.toLowerCase()}
          </Badge>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          Drag an appointment to another day to reschedule
        </span>
      </div>
    </div>
  );
}
