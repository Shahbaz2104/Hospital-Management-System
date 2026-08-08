import { rotateSession } from "@/lib/auth/session";
import { ApiError, ok, route } from "@/lib/http";

export const POST = route(async () => {
  const user = await rotateSession();
  if (!user) throw new ApiError(401, "Session expired");
  return ok({ user });
});