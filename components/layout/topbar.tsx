"use client";

import type { SessionUser } from "@/lib/auth/session";

import { GlobalSearch } from "@/components/layout/global-search";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function Topbar({ user }: { user: SessionUser }) {
  const now = new Date();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <MobileNav user={user} />
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <time
          dateTime={now.toISOString()}
          className="mr-1 hidden items-baseline gap-2 rounded-md border border-border/70 bg-card px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground lg:flex"
        >
          <span className="font-medium text-primary">{DAYS[now.getDay()]}</span>
          <span>
            {MONTHS[now.getMonth()]} {now.getDate()}, {now.getFullYear()}
          </span>
        </time>
        <NotificationBell />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
