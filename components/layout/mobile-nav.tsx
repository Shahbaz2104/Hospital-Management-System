"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Menu } from "lucide-react";

import { navConfig } from "@/constants/nav";
import { can } from "@/lib/auth/can";
import type { SessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex h-16 flex-row items-center gap-2 border-b px-4">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </span>
          <SheetTitle className="text-sm font-semibold">
            HealthCare HMS
          </SheetTitle>
        </SheetHeader>
        <nav className="h-[calc(100%-4rem)] space-y-4 overflow-y-auto px-3 py-4">
          {navConfig.map((section, i) => {
            const items = section.items.filter(
              (item) => !item.permission || can(user, item.permission as never)
            );
            if (!items.length) return null;
            return (
              <div key={section.title ?? i} className="space-y-1">
                {section.title && (
                  <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </p>
                )}
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const IconComp = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                      )}
                    >
                      {IconComp && <IconComp className="size-4 shrink-0" />}
                      <span className="flex-1 truncate">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}