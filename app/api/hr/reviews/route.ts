import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { createReview, listReviews } from "@/services/hr";
import { performanceReviewSchema } from "@/validators/hr";

export const GET = route(async (req) => {
  await requirePermission("hr:read");
  const url = new URL(req.url);
  return ok(
    await listReviews({
      employeeId: url.searchParams.get("employeeId")?.trim() || undefined,
    })
  );
});

export const POST = route(async (req) => {
  const actor = await requirePermission("hr:manage");
  const input = assertInput(performanceReviewSchema, await req.json().catch(() => null));
  const review = await createReview({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  return ok(review, { status: 201 });
});
