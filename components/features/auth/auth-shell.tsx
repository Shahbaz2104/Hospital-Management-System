import * as React from "react";
import Link from "next/link";
import { Activity, HeartHandshake, ShieldCheck, Zap } from "lucide-react";

import { AnimatedText } from "@/components/motion/animated-text";
import { Reveal } from "@/components/motion/reveal";

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
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r bg-[#0b1c33] p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 400px at 20% 10%, rgba(37,99,235,0.45), transparent 60%), radial-gradient(500px 400px at 90% 90%, rgba(56,189,248,0.25), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <Activity className="size-5 text-sky-300" />
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
              className="max-w-lg text-4xl font-semibold leading-tight tracking-tight text-balance"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-md text-sm leading-relaxed text-slate-300">
              The enterprise hospital management platform for patient records,
              appointments, billing, pharmacy, laboratory and beyond.
            </p>
          </Reveal>
          <ul className="max-w-sm space-y-3">
            {perks.map((perk, i) => (
              <Reveal key={perk.text} delay={0.15 + i * 0.05}>
                <li className="flex items-center gap-3 text-sm text-slate-200">
                  <perk.icon className="size-4 shrink-0 text-sky-300" />
                  {perk.text}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} HealthCare HMS. Secure by design.
        </p>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-background px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-5" />
            </span>
            <span className="text-sm font-semibold">HealthCare HMS</span>
          </div>

          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight">{title}</h2>
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