import { requirePermission } from "@/lib/auth/guards";
import { ApiError, assertInput, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { deleteEmployee, updateEmployee } from "@/services/hr";
import { employeeUpdateSchema } from "@/validators/hr";

export const GET = route(async (req, ctx) => {
  await requirePermission("hr:read");
  const { id } = await ctx.params;
  const employee = await db.employee.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, role: { select: { name: true, label: true } } } },
      department: { select: { id: true, name: true, code: true } },
    },
  });
  if (!employee) throw new ApiError(404, "Employee not found");
  return ok(employee);
});

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("hr:manage");
  const { id } = await ctx.params;
  const input = assertInput(employeeUpdateSchema, await req.json().catch(() => null));
  const employee = await updateEmployee({ userId: actor.id, hospitalId: actor.hospitalId }, id, input);
  return ok(employee);
});

export const DELETE = route(async (req, ctx) => {
  const actor = await requirePermission("hr:manage");
  const { id } = await ctx.params;
  await deleteEmployee({ userId: actor.id, hospitalId: actor.hospitalId }, id);
  return ok({ success: true });
});
