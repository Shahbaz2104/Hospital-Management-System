import { getSession } from "@/lib/auth/session";
import { ApiError, ok, route } from "@/lib/http";

export const GET = route(async () => {
  const user = await getSession();
  if (!user) throw new ApiError(401, "Unauthorized");
  return ok({ user });
});