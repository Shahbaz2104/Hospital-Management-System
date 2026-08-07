"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ChevronsLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { navConfig } from "@/constants/nav";
import { can } from "@/lib/auth/can";
import type { SessionUser } from "@/lib/auth/session";

import { Button } from "@/components/ui/button";

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        "hidden h-svh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex",
        "transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2 border-b px-4",
          collapsed && "justify-center px-0"
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="size-4" />
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-sm font-semibold">HealthCare HMS</p>
            <p className="text-[11px] text-muted-foreground">
              Hospital Management
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {navConfig.map((section, i) => {
          const items = section.items.filter(
            (item) => !item.permission || can(user, item.permission as never)
          );
          if (!items.length) return null;
          return (
            <div key={section.title ?? i} className="space-y-1">
              {section.title && !collapsed && (
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
              )}
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const IconComp = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                    )}
                  >
                    {!collapsed && active && (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    {IconComp && <IconComp className="size-4 shrink-0" />}
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.badge && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t p-3", collapsed && "flex justify-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className="gap-2 text-muted-foreground"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronsLeft
            className={cn(
              "size-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}