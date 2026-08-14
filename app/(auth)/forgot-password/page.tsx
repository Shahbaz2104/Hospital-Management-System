import type { Metadata } from "next";

import {
  AuthLink,
  AuthShell,
} from "@/components/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <>
          Remember your password? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}