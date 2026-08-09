"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Bell, CalendarClock, CheckCheck, FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPatch } from "@/lib/api";

type NotificationItem = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
  createdAt: string;
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  STOCK_ALERT: AlertTriangle,
  EXPIRY_ALERT: FlaskConical,
  APPOINTMENT: CalendarClock,
};

const TYPE_COLORS: Record<string, string> = {
  STOCK_ALERT: "text-amber-500",
  EXPIRY_ALERT: "text-orange-500",
  APPOINTMENT: "text-teal-500",
};

export function NotificationBell() {
  const queryClient = useQueryClient();

  const { data: count, isLoading } = useQuery({
    queryKey: ["notif-unread"],
    queryFn: () => apiGet<{ unread: number }>("/notifications/unread"),
    refetchInterval: 30_000,
  });

  const { data: recent, isLoading: loadingList } = useQuery({
    queryKey: ["notif-recent"],
    queryFn: () => apiGet<{ items: NotificationItem[] }>("/notifications", { pageSize: 8 }),
  });

  async function markAll() {
    await apiPatch("/notifications", {});
    queryClient.invalidateQueries({ queryKey: ["notif-unread"] });
    queryClient.invalidateQueries({ queryKey: ["notif-recent"] });
  }

  async function markOne(id: string) {
    await apiPatch(`/notifications/${id}`, { read: true });
    queryClient.invalidateQueries({ queryKey: ["notif-unread"] });
    queryClient.invalidateQueries({ queryKey: ["notif-recent"] });
  }

  const unread = count?.unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {isLoading ? null : unread > 0 ? (
            <span className="absolute right-1 top-1 flex size-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAll}>
                <CheckCheck className="size-3.5" /> Mark all read
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loadingList ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !recent || recent.items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            recent.items.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Bell;
              const color = TYPE_COLORS[n.type] ?? "text-primary";
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.read && markOne(n.id)}
                  className={`flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 ${n.read ? "opacity-60" : ""}`}
                >
                  <span className={`mt-0.5 ${color}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{n.title}</span>
                    {n.message && <span className="block truncate text-xs text-muted-foreground">{n.message}</span>}
                    <span className="block text-[10px] text-muted-foreground">
                      {format(new Date(n.createdAt), "MMM d, HH:mm")}
                    </span>
                  </span>
                  {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t p-1.5">
          <Button asChild size="sm" variant="ghost" className="w-full justify-center text-xs">
            <Link href="/notifications">View all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
