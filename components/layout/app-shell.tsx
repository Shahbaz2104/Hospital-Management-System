"use client";

import * as React from "react";

import type { SessionUser } from "@/lib/auth/session";

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
    <div className="flex min-h-svh">
      <Sidebar user={user} collapsed={collapsed} onToggle={setCollapsed} />
      <div className="flex min-h-svh flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 px-4 py-8 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
