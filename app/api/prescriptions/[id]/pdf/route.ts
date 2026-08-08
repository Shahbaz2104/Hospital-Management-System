import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/guards";
import { route } from "@/lib/http";
import { getPrescriptionForPdf, renderPrescriptionPdf } from "@/services/prescriptions";

export const GET = route(async (req, ctx) => {
  await requirePermission("prescriptions:read");
  const { id } = await ctx.params;
  const prescription = await getPrescriptionForPdf(id);
  const pdf = await renderPrescriptionPdf(prescription);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${prescription.prescriptionNo}.pdf"`,
    },
  });
});
