import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PatientsPage } from "@/components/features/patients/patients-page";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPageRoute() {
  await requirePermission("patients:read");
  return <PatientsPage />;
}