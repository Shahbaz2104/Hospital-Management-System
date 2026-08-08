import { NextResponse } from "next/server";

import { route } from "@/lib/http";
import { verifyPrescriptionQr } from "@/services/prescriptions";

/**
 * Public QR verification endpoint — accepts the payload embedded in the
 * prescription QR code and returns a minimal verification summary.
 */
export const GET = route(async (req) => {
  const url = new URL(req.url);
  const data = url.searchParams.get("data");
  if (!data) {
    return new NextResponse(
      `<!doctype html><html><body><h2>HMS Prescription verification</h2><p>Scan a prescription QR code to verify it.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
  const result = await verifyPrescriptionQr(data);
  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      body{font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 20px}
      .card{border:1px solid #e2e8f0;border-radius:12px;padding:24px}
      .ok{color:#047857}.bad{color:#b91c1c}h1{font-size:20px}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
      .row span{color:#64748b}</style></head><body>
      <div class="card"><h1 class="ok">✓ Verified prescription</h1>
      ${result.valid ? `
      <div class="row"><span>Prescription</span><b>${result.prescriptionNo}</b></div>
      <div class="row"><span>Patient</span><b>${result.patient} (${result.patientNo})</b></div>
      <div class="row"><span>Doctor</span><b>${result.doctor}</b></div>
      <div class="row"><span>Hospital</span><b>${result.hospital ?? "—"}</b></div>
      <div class="row"><span>Issued</span><b>${result.issuedAt.toDateString()}</b></div>
      <div class="row"><span>Status</span><b>${result.status}</b></div>` : ""}
      </div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
});
