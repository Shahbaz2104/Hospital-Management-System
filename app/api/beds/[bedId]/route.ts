import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ApiError, ok, route } from "@/lib/http";
import { db } from "@/lib/db";
import { setBedStatus } from "@/services/master-data";
import { bedStatusSchema } from "@/validators/master-data";

export const GET = route(async (req, ctx) => {
  await requirePermission("rooms:read");
  const { bedId } = await ctx.params;
  const bed = await db.bed.findUnique({ where: { id: bedId }, include: { room: { select: { number: true, type: true } } } });
  if (!bed) throw new ApiError(404, "Bed not found");
  return ok(bed);
});

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