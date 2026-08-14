import * as React from "react";
import Link from "next/link";
import { HeartPulse, ShieldCheck, Zap } from "lucide-react";

import { AnimatedText } from "@/components/motion/animated-text";
import { Reveal } from "@/components/motion/reveal";

const perks = [
  { icon: ShieldCheck, text: "Role-based access control for every team" },
  { icon: Zap, text: "Appointments, billing & pharmacy in one place" },
  { icon: HeartPulse, text: "Designed for hospitals, clinics & labs" },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#12141D] p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 480px at 12% 6%, oklch(0.55 0.17 264 / 0.35), transparent 62%), radial-gradient(560px 420px at 92% 92%, oklch(0.45 0.14 264 / 0.18), transparent 60%)",
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
            <HeartPulse className="size-5 text-[#A5B4FC]" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
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
            <p className="max-w-md text-sm leading-relaxed text-white/60">
              The enterprise hospital management platform for patient records,
              appointments, billing, pharmacy, laboratory and beyond.
            </p>
          </Reveal>
          <ul className="max-w-sm space-y-3">
            {perks.map((perk, i) => (
              <Reveal key={perk.text} delay={0.15 + i * 0.05}>
                <li className="flex items-center gap-3 text-sm text-white/75">
                  <perk.icon className="size-4 shrink-0 text-[#A5B4FC]" />
                  {perk.text}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>

        <div className="relative flex items-end justify-between">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} HealthCare HMS. Secure by design.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-background px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartPulse className="size-5" />
            </span>
            <span className="text-sm font-semibold">HealthCare HMS</span>
          </div>

          <h2 className="font-heading text-[1.7rem] font-semibold leading-9 tracking-tight">
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