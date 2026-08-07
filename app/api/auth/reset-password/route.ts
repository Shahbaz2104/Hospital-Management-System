import { assertInput, fail, getIp, ok, route } from "@/lib/http";
import { rateLimitByIp } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/validators/auth";
import { resetPassword } from "@/services/auth";
import { logAudit } from "@/services/audit";

export const POST = route(async (req) => {
  const rl = rateLimitByIp(getIp(req), "reset-password");
  if (!rl.ok) {
    return fail(429, "Too many attempts. Please try again later.", undefined, {
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  }

  const input = assertInput(resetPasswordSchema, await req.json().catch(() => null));
  const userId = await resetPassword(input.token, input.password);

  await logAudit({
    userId,
    action: "PASSWORD_RESET",
    entity: "User",
    entityId: userId,
    ipAddress: getIp(req),
  });

  return ok({ message: "Your password has been reset. You can now log in." });
});