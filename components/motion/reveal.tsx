"use client";

import * as React from "react";
import { useGSAP } from "@gsap/react";

import { EASE, gsap, usePrefersReducedMotion } from "@/lib/motion/gsap";

/**
 * Reveals its children once they enter the viewport.
 * Respects prefers-reduced-motion (renders without animation).
 */
export function Reveal({
  children,
  className,
  y = 24,
  delay = 0,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
  delay?: number;
  once?: boolean;
}) {
  const container = React.useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      const el = container.current;
      if (reduced || !el) return;
      const tween = gsap.from(el, {
        opacity: 0,
        y,
        duration: 0.7,
        delay,
        ease: EASE,
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          once,
        },
      });
      return () => {
        tween.scrollTrigger?.kill();
      };
    },
    { scope: container, dependencies: [reduced, delay, y, once] }
  );

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
}