import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { createLeave, listLeaves } from "@/services/hr";
import { leaveSchema } from "@/validators/hr";

export const GET = route(async (req) => {
  await requirePermission("hr:read");
  const url = new URL(req.url);
  return ok(
    await listLeaves({
      status: url.searchParams.get("status")?.trim() || undefined,
      search: url.searchParams.get("search")?.trim() || undefined,
    })
  );
});

export const POST = route(async (req) => {
  const actor = await requirePermission("hr:manage");
  const input = assertInput(leaveSchema, await req.json());
  const leave = await createLeave({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  return ok(leave, { status: 201 });
});
