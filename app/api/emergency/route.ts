import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { createEmergencyCase, listEmergencyCases } from "@/services/emergency";
import { emergencyCaseCreateSchema } from "@/validators/emergency";

export const GET = route(async (req) => {
  const actor = await requirePermission("emergency:read");
  void actor;
  const url = new URL(req.url);
  return ok(
    await listEmergencyCases({
      status: url.searchParams.get("status") ?? undefined,
      triageLevel: url.searchParams.get("triage") ?? undefined,
      search: url.searchParams.get("q") ?? undefined,
    })
  );
});

export const POST = route(async (req) => {
  const actor = await requirePermission("emergency:manage");
  const input = assertInput(emergencyCaseCreateSchema, await req.json().catch(() => null));
  return ok(await createEmergencyCase(actor, input));
});
