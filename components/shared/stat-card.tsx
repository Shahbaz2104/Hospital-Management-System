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

/**
 * Clean enterprise readout: sans label, tabular headline number,
 * quiet icon chip. Reads at a glance, nothing decorative.
 */
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
        "card-hover rounded-lg border bg-card p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-2 text-[1.75rem] font-semibold tabular-nums tracking-tight text-foreground">
              {typeof value === "number" ? (
                <AnimatedNumber value={value} />
              ) : (
                value ?? "—"
              )}
            </p>
          )}
          {hint && !loading && (
            <p className="mt-1.5 text-xs text-muted-foreground/80">{hint}</p>
          )}
        </div>
        <span className="shrink-0 rounded-lg bg-primary/[0.08] p-2.5 text-primary ring-1 ring-primary/10">
          <Icon className="size-4" strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}