"use client";

import * as React from "react";
import { animate, stagger } from "animejs";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion/gsap";

/**
 * Character-level text reveal powered by anime.js v4.
 * Each character rises from a masked baseline — subtle, quiet, premium.
 * Falls back to plain text with reduced motion or no JS.
 */
export function AnimatedText({
  text,
  as: As = "span",
  className,
  delay = 0,
  staggerMs = 18,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "span" | "p";
  className?: string;
  delay?: number;
  staggerMs?: number;
}) {
  const ref = React.useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = React.useState(false);

  const words = text.split(" ");
  const charCount = words.reduce((n, w) => n + w.length, 0);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted || reduced || !ref.current) return;
    const chars = ref.current.querySelectorAll<HTMLElement>("[data-at-char]");
    if (!chars.length) return;

    const anim = animate(chars, {
      y: ["1.1em", 0],
      opacity: [0, 1],
      rotate: [3, 0],
      duration: 650,
      delay: stagger(staggerMs, { start: delay, from: "first" }),
      easing: "outExpo",
    });

    return () => {
      anim.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, reduced, charCount]);

  if (!mounted || reduced) {
    return (
      <As className={className} ref={ref as React.Ref<HTMLHeadingElement>}>
        {text}
      </As>
    );
  }

  return (
    <As ref={ref as React.Ref<HTMLHeadingElement>} className={cn(className, "overflow-hidden")}>
      {words.map((word, wi) => (
        <span
          key={wi}
          className="inline-block whitespace-nowrap"
          aria-hidden="true"
        >
          {word.split("").map((char, ci) => (
            <span
              key={ci}
              data-at-char
              className="inline-block opacity-0 will-change-transform"
            >
              {char}
            </span>
          ))}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
      <span className="sr-only">{text}</span>
    </As>
  );
}