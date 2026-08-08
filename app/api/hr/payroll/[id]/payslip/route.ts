import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/guards";
import { route } from "@/lib/http";
import { buildPayslipPdf } from "@/services/hr";

export const GET = route(async (_req, ctx) => {
  await requirePermission("payroll:read");
  const { id } = await ctx.params;
  const pdf = await buildPayslipPdf(id);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payslip-${id}.pdf"`,
    },
  });
});
