import * as React from "react";
import Link from "next/link";
import { HeartHandshake, ShieldCheck, Zap } from "lucide-react";

import { AnimatedText } from "@/components/motion/animated-text";
import { Reveal } from "@/components/motion/reveal";
import { VitalsLine } from "@/components/shared/vitals-line";

const perks = [
  { icon: ShieldCheck, text: "Role-based access control for every team" },
  { icon: Zap, text: "Appointments, billing & pharmacy in one place" },
  { icon: HeartHandshake, text: "Designed for hospitals, clinics & labs" },
];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#0B1F24] p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 480px at 12% 6%, oklch(0.55 0.11 175 / 0.4), transparent 62%), radial-gradient(560px 420px at 92% 92%, oklch(0.45 0.1 175 / 0.22), transparent 60%)",
          }}
        />
        <div aria-hidden className="absolute inset-x-0 top-0 h-10 border-b border-white/10">
          <div className="relative mx-10 h-full text-primary/90">
            <VitalsLine className="h-full" flow />
          </div>
        </div>

        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
            <svg viewBox="0 0 32 32" aria-hidden className="size-5 text-[#7FE0D0]">
              <path
                d="M3 16h4l1.2 0 .9-2.8 1.2 5.6.9-4 1.2 1.2h5l1.2 0 .9-3.9 1.2 7.3.9-4.5 1.2 1.2h5l1.2 0 .9-2.8 1.2 5.6.9-4 1.2 1.2h2.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-heading text-sm font-semibold tracking-tight">
            HealthCare HMS
          </span>
        </div>

        <div className="relative space-y-8">
          <Reveal>
            <AnimatedText
              as="h1"
              text="Care that runs on systems that run well."
              className="max-w-lg font-heading text-4xl font-semibold leading-tight tracking-tight text-balance"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-md text-sm leading-relaxed text-[#B9CFCB]">
              The enterprise hospital management platform for patient records,
              appointments, billing, pharmacy, laboratory and beyond.
            </p>
          </Reveal>
          <ul className="max-w-sm space-y-3">
            {perks.map((perk, i) => (
              <Reveal key={perk.text} delay={0.15 + i * 0.05}>
                <li className="flex items-center gap-3 text-sm text-[#D6E6E2]">
                  <perk.icon className="size-4 shrink-0 text-[#7FE0D0]" />
                  {perk.text}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>

        <div className="relative flex items-end justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8FB3AD]">
            Monitoring · Round the clock
          </p>
          <p className="text-xs text-[#8FB3AD]">
            © {new Date().getFullYear()} HealthCare HMS. Secure by design.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-background px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg viewBox="0 0 32 32" aria-hidden className="size-5">
                <path
                  d="M3 16h4l1.2 0 .9-2.8 1.2 5.6.9-4 1.2 1.2h5l1.2 0 .9-3.9 1.2 7.3.9-4.5 1.2 1.2h5l1.2 0 .9-2.8 1.2 5.6.9-4 1.2 1.2h2.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="font-heading text-sm font-semibold">HealthCare HMS</span>
          </div>

          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-1.5 font-heading text-[1.7rem] font-semibold leading-9 tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          )}

          <div className="mt-8">{children}</div>

          {footer && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
