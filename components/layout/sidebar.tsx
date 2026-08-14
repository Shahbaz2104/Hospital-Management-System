"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { navConfig } from "@/constants/nav";
import { can } from "@/lib/auth/can";
import type { SessionUser } from "@/lib/auth/session";

import { Button } from "@/components/ui/button";

/** Brand mark: clean indigo chip with a simple heartbeat glyph. */
function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm",
        className
      )}
    >
      <HeartPulse className="size-5" strokeWidth={2} />
    </span>
  );
}

export function Sidebar({
  user,
  collapsed,
  onToggle,
}: {
  user: SessionUser;
  collapsed: boolean;
  onToggle: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex",
        "transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-3 border-b px-4",
          collapsed && "justify-center px-0"
        )}
      >
        <BrandMark />
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight">
              HealthCare HMS
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Hospital management
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" data-lenis-prevent>
        {navConfig.map((section, i) => {
          const items = section.items.filter(
            (item) => !item.permission || can(user, item.permission as never)
          );
          if (!items.length) return null;
          return (
            <div key={section.title ?? i} className="space-y-0.5">
              {section.title && !collapsed && (
                <p className="px-3 pb-1 text-[11px] font-medium text-muted-foreground">
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
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-accent font-semibold text-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
                    )}
                  >
                    {!collapsed && active && (
                      <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    {IconComp && (
                      <IconComp
                        className={cn(
                          "size-4 shrink-0",
                          active && "text-primary"
                        )}
                        strokeWidth={2}
                      />
                    )}
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.badge && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
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
          onClick={() => onToggle(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronsLeft
            className={cn(
              "size-4 transition-transform duration-200",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}