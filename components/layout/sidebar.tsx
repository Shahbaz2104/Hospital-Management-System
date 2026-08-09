"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { navConfig } from "@/constants/nav";
import { can } from "@/lib/auth/can";
import type { SessionUser } from "@/lib/auth/session";

import { Button } from "@/components/ui/button";

/** Brand mark: scrub-teal ward chip with the ECG trace. */
function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-[0_2px_10px_-2px_oklch(0.35_0.1_176/0.5)]",
        className
      )}
    >
      <svg viewBox="0 0 32 32" aria-hidden className="size-6">
        <path
          d="M3 16h4l1.2 0 .9-2.8 1.2 5.6.9-4 1.2 1.2h5l1.2 0 .9-3.9 1.2 7.3.9-4.5 1.2 1.2h5l1.2 0 .9-2.8 1.2 5.6.9-4 1.2 1.2h2.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
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
            <p className="font-heading text-[15px] font-semibold tracking-tight">
              HealthCare HMS
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Ward operations
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" data-lenis-prevent>
        {navConfig.map((section, i) => {
          const items = section.items.filter(
            (item) => !item.permission || can(user, item.permission as never)
          );
          if (!items.length) return null;
          return (
            <div key={section.title ?? i} className="space-y-1">
              {section.title && !collapsed && (
                <p className="px-3 pb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
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
                        ? "bg-primary/[0.08] font-semibold text-primary dark:bg-primary/15"
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
                      />
                    )}
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.badge && (
                          <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-medium text-primary-foreground">
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
