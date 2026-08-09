"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion/gsap";

/**
 * The ECG trace — the ward board's signature motif.
 * A heartbeat polyline rendered as a chart strip. `flow` adds a slow
 * monitor sweep (dashoffset drift); the draw-on animation plays once on
 * mount. Everything degrades to a static trace with reduced motion.
 */
export function VitalsLine({
  className,
  flow = false,
}: {
  className?: string;
  flow?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const [drawn, setDrawn] = React.useState(false);

  React.useEffect(() => {
    if (reduced) return;
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const animate = flow && !reduced;

  return (
    <svg
      viewBox="0 0 96 24"
      preserveAspectRatio="none"
      aria-hidden
      className={cn("pointer-events-none h-4 w-full", className)}
    >
      <path
        d="M0 12h10l2 0 1.5-5 2 10 1.5-7 2 2h14l2 0 1.5-7 2 13 1.5-8 2 2h14l2 0 1.5-4 2 8 1.5-6 2 2h10l2 0 1.5-5 2 10 1.5-7 2 2h8"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength={100}
        strokeDasharray={animate ? "46 54" : undefined}
        strokeDashoffset={drawn ? (animate ? 100 : 0) : animate ? 100 : 0}
        className={cn(animate && "vitals-flow")}
      />
    </svg>
  );
}
