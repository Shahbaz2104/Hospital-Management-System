import { cookies } from "next/headers";

import { getIp, getUserAgent, ok, route } from "@/lib/http";
import { revokeSession } from "@/services/auth";
import { logAudit } from "@/services/audit";

export const POST = route(async (req) => {
  const store = await cookies();
  const refreshToken = store.get("hms_refresh")?.value;

  await revokeSession(refreshToken ?? "");
  store.set("hms_access", "", { path: "/", maxAge: 0, httpOnly: true });
  store.set("hms_refresh", "", { path: "/", maxAge: 0, httpOnly: true });

  await logAudit({
    action: "LOGOUT",
    ipAddress: getIp(req),
    userAgent: getUserAgent(req),
  });

  return ok({ loggedOut: true });
});