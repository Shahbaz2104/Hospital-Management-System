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
  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar user={user} />
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}