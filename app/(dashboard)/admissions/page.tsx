import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { AdmissionsPage } from "@/components/features/admissions/admissions-page";

export const metadata: Metadata = { title: "Admissions" };

export default async function AdmissionsPageRoute() {
  await requirePermission("admissions:read");
  return <AdmissionsPage />;
}
