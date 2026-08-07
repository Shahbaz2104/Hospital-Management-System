"use client";

import * as React from "react";

import type { SessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="min-h-svh">
      <Sidebar user={user} collapsed={collapsed} onToggle={setCollapsed} />
      <div
        className={cn(
          "flex min-h-svh flex-col transition-[padding-left] duration-200",
          collapsed ? "md:pl-16" : "md:pl-64"
        )}
      >
        <Topbar user={user} />
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
