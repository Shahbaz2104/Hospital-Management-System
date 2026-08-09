import { requirePermission } from "@/lib/auth/guards";
import { ApiError, route } from "@/lib/http";
import { buildReceiptPdf } from "@/services/receipts";

/** Inline PDF receipt for a completed payment. */
export const GET = route(async (_req, ctx) => {
  await requirePermission("billing:read");
  const { id } = await ctx.params;
  let pdf: Uint8Array;
  try {
    pdf = await buildReceiptPdf(id);
  } catch (e) {
    throw new ApiError(404, e instanceof Error ? e.message : "Receipt unavailable");
  }
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
