"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/shared/animated-number";

type StatCardProps = {
  label: string;
  icon: LucideIcon;
  value?: number | string;
  loading?: boolean;
  hint?: string;
  className?: string;
};

export function StatCard({
  label,
  icon: Icon,
  value,
  loading,
  hint,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "card-hover group relative overflow-hidden rounded-lg border bg-card p-4",
        className
      )}
    >
      <div className="pointer-events-none absolute -top-16 -right-16 size-32 rounded-full bg-primary/5 blur-2xl transition-opacity duration-300 opacity-60 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1.5 h-8 w-16" />
          ) : (
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
              {typeof value === "number" ? (
                <AnimatedNumber value={value} />
              ) : (
                value ?? "—"
              )}
            </p>
          )}
          {hint && !loading && (
            <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p>
          )}
        </div>
        <span className="rounded-md bg-gradient-to-br from-primary/15 to-primary/5 p-2 text-primary ring-1 ring-primary/10 transition-transform duration-300 group-hover:scale-110">
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}