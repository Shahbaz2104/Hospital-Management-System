import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { signAccessToken } from "@/lib/auth/jwt";
import { assertInput, fail, getIp, getUserAgent, ok, route } from "@/lib/http";
import { rateLimitByIp } from "@/lib/rate-limit";
import { loginSchema } from "@/validators/auth";
import { authenticateUser, auditLogin, issueSession, roleLabelOf, updateLastLogin } from "@/services/auth";

export const POST = route(async (req) => {
  const ip = getIp(req);
  const ua = getUserAgent(req);

  const rl = rateLimitByIp(ip, "login");
  if (!rl.ok) {
    return fail(429, "Too many attempts. Please try again later.", undefined, {
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  }

  const input = assertInput(loginSchema, await req.json().catch(() => null));
  const user = await authenticateUser(input.email, input.password);

  const accessToken = await signAccessToken(user.id, user.role.name);
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

  await updateLastLogin(user.id);
  await auditLogin(user.id, ip, ua);

  return ok({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleName: user.role.name,
      roleLabel: roleLabelOf(user.role.name),
      hospitalId: user.hospitalId,
    },
  });
});