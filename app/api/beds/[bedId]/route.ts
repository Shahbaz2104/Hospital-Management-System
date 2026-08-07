import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { setBedStatus } from "@/services/master-data";
import { bedStatusSchema } from "@/validators/master-data";

export const PATCH = route(async (req: Request, ctx) => {
  const actor = await requirePermission("rooms:manage");
  const { bedId } = await ctx.params;
  const input = assertInput(
    bedStatusSchema.pick({ status: true, patientId: true }),
    await req.json().catch(() => null)
  );

  const bed = await setBedStatus(
    { userId: actor.id, hospitalId: actor.hospitalId },
    bedId,
    input
  );
  return ok(bed, {
    status: 200,
  });
});