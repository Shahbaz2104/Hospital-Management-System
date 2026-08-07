import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { signAccessToken } from "@/lib/auth/jwt";
import { assertInput, fail, getIp, getUserAgent, ok, route } from "@/lib/http";
import { rateLimitByIp } from "@/lib/rate-limit";
import { registerSchema } from "@/validators/auth";
import { issueSession, registerUser } from "@/services/auth";
import { logAudit } from "@/services/audit";

export const POST = route(async (req) => {
  const ip = getIp(req);
  const ua = getUserAgent(req);

  const rl = rateLimitByIp(ip, "register");
  if (!rl.ok) {
    return fail(429, "Too many attempts. Please try again later.", undefined, {
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  }

  const input = assertInput(registerSchema, await req.json().catch(() => null));
  const user = await registerUser(input);

  const accessToken = await signAccessToken(user.id, "PATIENT");
  const session = await issueSession({
    userId: user.id,
    accessToken,
    ipAddress: ip,
    userAgent: ua,
  });

  const store = await cookies();
  store.set("hms_access", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.JWT_ACCESS_EXPIRES_IN,
  });
  store.set("hms_refresh", session.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.JWT_REFRESH_EXPIRES_IN,
  });

  await logAudit({
    userId: user.id,
    action: "REGISTERED",
    entity: "User",
    entityId: user.id,
    meta: { email: user.email },
    ipAddress: ip,
    userAgent: ua,
  });

  return ok(
    {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    },
    { status: 201 }
  );
});