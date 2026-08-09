import { requirePermission } from "@/lib/auth/guards";
import { assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { createInvoice, listInvoices } from "@/services/billing";
import { createInvoiceSchema } from "@/validators/billing";

export const GET = route(async (req) => {
  await requirePermission("billing:read");
  const params = new URL(req.url).searchParams;
  const result = await listInvoices({
    status: params.get("status") ?? "ALL",
    search: params.get("search") ?? undefined,
    page: Number(params.get("page") ?? 1),
    pageSize: Number(params.get("pageSize") ?? 20),
  });
  return ok(result);
});

export const POST = route(async (req) => {
  const actor = await requirePermission("billing:manage");
  const input = assertInput(createInvoiceSchema, await req.json().catch(() => null));
  const invoice = await createInvoice({ userId: actor.id, hospitalId: actor.hospitalId }, input);
  await logAudit({
    userId: actor.id,
    action: "INVOICE_CREATED",
    entity: "Invoice",
    entityId: invoice.id,
    meta: { invoiceNo: invoice.invoiceNo },
    ipAddress: getIp(req),
  });
  return ok(invoice);
});
