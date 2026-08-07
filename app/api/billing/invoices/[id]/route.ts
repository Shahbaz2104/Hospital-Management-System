import { requirePermission } from "@/lib/auth/guards";
import { ApiError, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { cancelInvoice, getInvoice } from "@/services/billing";

export const GET = route(async (_req, ctx) => {
  await requirePermission("billing:read");
  const { id } = await ctx.params;
  return ok(await getInvoice(id));
});

export const PATCH = route(async (req, ctx) => {
  const actor = await requirePermission("billing:manage");
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const action = body && typeof body === "object" ? String((body as Record<string, unknown>).action ?? "") : "";

  if (action === "cancel") {
    const invoice = await cancelInvoice({ userId: actor.id, hospitalId: actor.hospitalId }, id);
    await logAudit({
      userId: actor.id,
      action: "INVOICE_CANCELLED",
      entity: "Invoice",
      entityId: id,
      meta: { invoiceNo: invoice.invoiceNo },
      ipAddress: getIp(req),
    });
    return ok(invoice);
  }
  throw new ApiError(400, "Unknown action");
});
