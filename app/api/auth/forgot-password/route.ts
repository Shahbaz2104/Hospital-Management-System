import { assertInput, fail, getIp, ok, route } from "@/lib/http";
import { rateLimitByIp } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/validators/auth";
import { requestPasswordReset } from "@/services/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

export const POST = route(async (req) => {
  const rl = rateLimitByIp(getIp(req), "forgot-password");
  if (!rl.ok) {
    return fail(429, "Too many attempts. Please try again later.", undefined, {
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  }

  const input = assertInput(forgotPasswordSchema, await req.json().catch(() => null));
  const result = await requestPasswordReset(input.email);

  if (result) {
    const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${result.token}`;
    const delivered = await sendEmail({
      to: result.user.email,
      subject: "Reset your password",
      text: `Reset your password using this link: ${resetUrl}\n\nThis link expires in 1 hour.`,
      html: `<p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
    });
    // Only surface the reset link in logs when SMTP is NOT configured (dev).
    // Never log it when the email was actually delivered — the token is a
    // one-time password for the target mailbox.
    if (delivered.devOnlyToken) {
      console.info(`[forgot-password] reset link for ${input.email}: ${resetUrl}`);
    }
  }

  // Always return the same message to avoid leaking which emails exist.
  return ok({ message: "If an account exists for that email, a reset link has been sent." });
});