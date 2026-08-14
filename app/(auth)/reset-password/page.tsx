import type { Metadata } from "next";

import {
  AuthLink,
  AuthShell,
} from "@/components/features/auth/auth-shell";
import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthShell
        title="Invalid reset link"
        subtitle="This link is missing its token. Please request a new one."
        footer={
          <>
            <AuthLink href="/forgot-password">Request a new link</AuthLink>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Password reset links are single-use and expire after one hour.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Your password should be at least 8 characters, with an uppercase letter and a number."
      footer={
        <>
          Remember your password? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}