import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createLabTest, listLabTests } from "@/services/diagnostics";
import { labTestSchema } from "@/validators/diagnostics";

export const GET = route(async () => {
  await requirePermission("laboratory:read");
  const tests = await listLabTests();
  return ok({ items: tests });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("laboratory:manage");
  const input = assertInput(labTestSchema, await req.json().catch(() => null));

  const test = await createLabTest(
    { userId: actor.id, hospitalId: actor.hospitalId },
    input
  );
  await logAudit({
    userId: actor.id,
    action: "LAB_TEST_CREATED",
    entity: "LabTest",
    entityId: test.id,
    meta: { code: test.code },
    ipAddress: getIp(req),
  });
  return ok(test, { status: 201 });
});
