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
 * Vitals-monitor readout: mono label stamp, tabular headline number,
 * a quiet ECG tick in the corner. Reads like a monitored vital sign.
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
        "card-hover group relative overflow-hidden rounded-lg border bg-card p-4",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary/0 via-primary/70 to-primary/0 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
      />
      <svg
        aria-hidden
        viewBox="0 0 96 24"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -bottom-1 right-0 h-6 w-24 text-primary opacity-[0.14] transition-opacity duration-300 group-hover:opacity-30"
      >
        <path
          d="M0 12h10l2 0 1.5-5 2 10 1.5-7 2 2h14l2 0 1.5-7 2 13 1.5-8 2 2h14l2 0 1.5-4 2 8 1.5-6 2 2h10l2 0 1.5-5 2 10 1.5-7 2 2h8"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <p className="mt-1.5 font-heading text-[1.55rem] font-semibold tabular-nums tracking-tight text-foreground">
              {typeof value === "number" ? (
                <AnimatedNumber value={value} />
              ) : (
                value ?? "—"
              )}
            </p>
          )}
          {hint && !loading && (
            <p className="mt-1 font-mono text-[10.5px] text-muted-foreground/70">
              {hint}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-md bg-primary/[0.08] p-2 text-primary ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-110">
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}
