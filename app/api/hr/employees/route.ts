import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { createEmployee, listEmployees } from "@/services/hr";
import { employeeSchema } from "@/validators/hr";

export const GET = route(async (req) => {
  const actor = await requirePermission("hr:read");
  const url = new URL(req.url);
  return ok(
    await listEmployees({
      search: url.searchParams.get("search")?.trim() ?? undefined,
      departmentId: url.searchParams.get("departmentId")?.trim() ?? undefined,
      status: url.searchParams.get("status")?.trim() ?? undefined,
      page: Number(url.searchParams.get("page")) || 1,
      pageSize: Number(url.searchParams.get("pageSize")) || 20,
      hospitalId: actor.hospitalId,
    })
  );
});

export const POST = route(async (req) => {
  const actor = await requirePermission("hr:manage");
  const input = assertInput(employeeSchema, await req.json().catch(() => null));
  const employee = await createEmployee({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  return ok(employee, { status: 201 });
});
