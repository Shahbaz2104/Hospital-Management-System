"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  FlaskConical,
  Inbox,
  Loader2,
  Mail,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPatch } from "@/lib/api";

type NotificationItem = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  entity: string | null;
  entityId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  STOCK_ALERT: { label: "Stock alert", icon: AlertTriangle, cls: "text-amber-500 bg-amber-500/10" },
  EXPIRY_ALERT: { label: "Expiry alert", icon: FlaskConical, cls: "text-orange-500 bg-orange-500/10" },
  APPOINTMENT: { label: "Appointment", icon: CalendarClock, cls: "text-indigo-500 bg-indigo-500/10" },
  BILLING: { label: "Billing", icon: Wallet, cls: "text-emerald-500 bg-emerald-500/10" },
  HR: { label: "HR", icon: ShieldCheck, cls: "text-violet-500 bg-violet-500/10" },
  SYSTEM: { label: "System", icon: Bell, cls: "text-primary bg-primary/10" },
};

export function NotificationsPage() {
  const [tab, setTab] = React.useState<"all" | "unread">("all");
  const [pending, setPending] = React.useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-page", tab],
    queryFn: () =>
      apiGet<{ items: NotificationItem[]; unread: number; total: number }>("/notifications", {
        pageSize: 100,
        ...(tab === "unread" ? { unread: true } : {}),
      }),
  });

  const { data: unreadCount } = useQuery({
    queryKey: ["notif-unread"],
    queryFn: () => apiGet<{ unread: number }>("/notifications/unread"),
    refetchInterval: 30_000,
  });

  const items = data?.items ?? [];
  const unread = unreadCount?.unread ?? data?.unread ?? 0;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["notifications-page"] });
    queryClient.invalidateQueries({ queryKey: ["notif-unread"] });
    queryClient.invalidateQueries({ queryKey: ["notif-recent"] });
  }

  async function markAll() {
    setPending(true);
    try {
      await apiPatch("/notifications", {});
      toast("All notifications marked as read");
      invalidate();
    } catch {
      toast("Failed to mark all as read");
    } finally {
      setPending(false);
    }
  }

  async function markOne(n: NotificationItem) {
    if (n.read) return;
    try {
      await apiPatch(`/notifications/${n.id}`, { read: true });
      invalidate();
    } catch {}
  }

  return (
    <div>
      <PageHeader title="Notifications" description="Alerts and reminders for your role" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Unread" icon={Bell} value={unread} loading={isLoading} />
        <StatCard label="Total" icon={Inbox} value={data?.total ?? items.length} loading={isLoading} />
        <StatCard label="Read" icon={Mail} value={(data?.total ?? 0) - unread} loading={isLoading} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="sm" variant="outline" onClick={markAll} disabled={pending || unread === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
          Mark all read
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No notifications{tab === "unread" ? " unread" : ""}.</p>
        ) : (
          <div className="divide-y">
            {items.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.SYSTEM;
              const Icon = meta.icon;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markOne(n)}
                  className={`flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50 ${n.read ? "opacity-55" : ""}`}
                >
                  <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.cls}`}>
                    <Icon className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{n.title}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                    </span>
                    {n.message && <span className="mt-0.5 block text-sm text-muted-foreground">{n.message}</span>}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {format(new Date(n.createdAt), "MMM d, yyyy 'at' HH:mm")}
                      {n.read && n.readAt ? ` · read ${format(new Date(n.readAt), "MMM d, HH:mm")}` : ""}
                    </span>
                  </span>
                  {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
