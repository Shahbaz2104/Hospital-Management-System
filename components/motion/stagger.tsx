"use client";

import * as React from "react";
import { useGSAP } from "@gsap/react";

import { EASE, gsap, usePrefersReducedMotion } from "@/lib/motion/gsap";

/**
 * Staggers direct children that carry `data-stagger-item`.
 * Children fade + rise in order when the container enters the viewport.
 */
export function Stagger({
  children,
  className,
  gap = 0.07,
  delay = 0,
  y = 18,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  y?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced || !ref.current) return;
      const items = ref.current.querySelectorAll("[data-stagger-item]");
      if (!items.length) return;

      const tween = gsap.from(items, {
        opacity: 0,
        y,
        duration: 0.6,
        delay,
        ease: EASE,
        stagger: { each: gap, from: "start" },
        scrollTrigger: {
          trigger: ref.current,
          start: "top 90%",
          once: true,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
      };
    },
    { scope: ref, dependencies: [gap, delay, y, reduced] }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}