import type { Metadata } from "next";

import {
  AuthLink,
  AuthShell,
} from "@/components/features/auth/auth-shell";
import { LoginForm } from "@/components/features/auth/login-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

/** Open-redirect guard: only allow same-origin relative paths. */
function safeFrom(from?: string): string | undefined {
  if (!from) return undefined;
  if (!from.startsWith("/")) return undefined;
  if (from.startsWith("//") || from.includes("://")) return undefined;
  return from;
}

const demoAccounts = [
  { role: "Super Admin", email: "admin@hospital.com", password: "Admin@1234" },
  { role: "Doctor", email: "doctor@hospital.com", password: "Doctor@1234" },
  { role: "Patient", email: "patient@hospital.com", password: "Patient@1234" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return (
    <AuthShell
      title="Sign in to your account"
      subtitle="Manage patients, appointments, billing and more from one place."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <AuthLink href="/register">Create one</AuthLink>
        </>
      }
    >
      <LoginForm from={safeFrom(from)} />
      <Card className="mt-6">
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Demo access</p>
          <ul className="space-y-1">
            {demoAccounts.map((a) => (
              <li key={a.email} className="flex justify-between gap-4">
                <span>{a.role}</span>
                <span className="tabular-nums">{a.email}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </AuthShell>
  );
}