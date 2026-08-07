import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ApiError, getIp, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { logAudit } from "@/services/audit";
import { deleteDepartment, updateDepartment } from "@/services/master-data";
import { departmentSchema } from "@/validators/master-data";

export const PATCH = route(async (req: Request, ctx) => {
  const actor = await requirePermission("departments:manage");
  const { id } = await ctx.params;
  const input = assertInput(
    departmentSchema.partial(),
    await req.json().catch(() => null)
  );

  if (input.code) {
    const dup = await db.department.findFirst({
      where: { code: input.code, NOT: { id } },
    });
    if (dup) throw new ApiError(409, `Department code ${input.code} already exists`);
  }

  const dept = await updateDepartment(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id,
    input
  );
  await logAudit({
    userId: actor.id,
    action: "DEPARTMENT_UPDATED",
    entity: "Department",
    entityId: id,
    ipAddress: getIp(req),
  });
  return ok(dept);
});

export const DELETE = route(async (req, ctx) => {
  const actor = await requirePermission("departments:manage");
  const { id } = await ctx.params;
  await deleteDepartment(
    { userId: actor.id, hospitalId: actor.hospitalId },
    id
  );
  return ok({ deleted: true });
});