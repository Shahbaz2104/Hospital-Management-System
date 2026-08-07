import type { Metadata } from "next";

import {
  AuthLink,
  AuthShell,
} from "@/components/features/auth/auth-shell";
import { RegisterForm } from "@/components/features/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="New here?"
      title="Create your account"
      subtitle="Register as a patient to book appointments and view your records."
      footer={
        <>
          Already have an account?{" "}
          <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}