import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/guards";
import { ApiError, route } from "@/lib/http";
import { exportReportExcel, exportReportPdf, REPORT_TYPES, runReport } from "@/services/reports";

export const GET = route(async (req) => {
  await requirePermission("reports:export");
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  const format = url.searchParams.get("format") ?? "pdf";
  const from = url.searchParams.get("from")?.trim() || undefined;
  const to = url.searchParams.get("to")?.trim() || undefined;

  if (!(REPORT_TYPES as readonly string[]).includes(type)) {
    throw new ApiError(400, `Unknown report type: ${type}`);
  }
  if (format !== "pdf" && format !== "excel") {
    throw new ApiError(400, "Format must be pdf or excel");
  }

  const report = await runReport(type as (typeof REPORT_TYPES)[number], { from, to });
  const stamp = `${type}-${from ?? "all"}-${to ?? "today"}`.replace(/[^\w-]+/g, "_");

  if (format === "excel") {
    const buffer = await exportReportExcel(report);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${stamp}.xlsx"`,
      },
    });
  }

  const pdf = await exportReportPdf(report);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-${stamp}.pdf"`,
    },
  });
});
