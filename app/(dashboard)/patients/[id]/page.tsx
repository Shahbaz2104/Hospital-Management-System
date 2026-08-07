import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PatientDetail } from "@/components/features/patients/patient-detail";

export const metadata: Metadata = { title: "Patient" };

export default async function PatientDetailPage() {
  await requirePermission("patients:read");
  return <PatientDetail />;
}
