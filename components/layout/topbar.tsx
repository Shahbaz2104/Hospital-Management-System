"use client";

import { Search } from "lucide-react";

import type { SessionUser } from "@/lib/auth/session";

import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Input } from "@/components/ui/input";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <MobileNav user={user} />
      <div className="relative hidden w-full max-w-md sm:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patients, doctors, medicines, invoices..."
          className="pl-9"
          aria-label="Global search"
        />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}