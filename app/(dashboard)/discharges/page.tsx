import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { DischargesPage } from "@/components/features/admissions/discharges-page";

export const metadata: Metadata = { title: "Discharges" };

export default async function DischargesPageRoute() {
  await requirePermission("discharges:read");
  return <DischargesPage />;
}
