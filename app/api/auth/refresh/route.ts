import { getSession } from "@/lib/auth/session";
import { ApiError, ok, route } from "@/lib/http";

export const POST = route(async () => {
  const user = await getSession();
  if (!user) throw new ApiError(401, "Session expired");
  return ok({ user });
});