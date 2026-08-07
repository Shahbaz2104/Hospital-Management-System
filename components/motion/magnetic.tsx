"use client";

import * as React from "react";
import { gsap } from "@/lib/motion/gsap";

/**
 * Wraps a child in a pointer-following element. The child is drawn
 * toward the cursor (subtle, magnetic feel) and springs back on leave.
 */
export function Magnetic({
  children,
  strength = 0.35,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const xTo = React.useRef<((v: number) => void) | null>(null);
  const yTo = React.useRef<((v: number) => void) | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    xTo.current = gsap.quickTo(ref.current, "x", {
      duration: 0.4,
      ease: "power3.out",
    });
    yTo.current = gsap.quickTo(ref.current, "y", {
      duration: 0.4,
      ease: "power3.out",
    });
  }, []);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - (rect.left + rect.width / 2)) * strength;
    const y = (e.clientY - (rect.top + rect.height / 2)) * strength;
    xTo.current?.(x);
    yTo.current?.(y);
  };

  const onPointerLeave = () => {
    xTo.current?.(0);
    yTo.current?.(0);
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ display: "inline-block", willChange: "transform" }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>
  );
}