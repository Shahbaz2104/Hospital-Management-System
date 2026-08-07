import { assertInput, getIp, ok, route } from "@/lib/http";
import { requireSession } from "@/lib/auth/guards";
import { changePasswordSchema } from "@/validators/auth";
import { changePassword } from "@/services/auth";
import { logAudit } from "@/services/audit";

export const POST = route(async (req) => {
  const user = await requireSession();
  const input = assertInput(changePasswordSchema, await req.json().catch(() => null));

  await changePassword(user.id, input.currentPassword, input.newPassword);

  await logAudit({
    userId: user.id,
    action: "PASSWORD_CHANGED",
    entity: "User",
    entityId: user.id,
    ipAddress: getIp(req),
  });

  return ok({ message: "Password changed successfully. Please log in again." });
});