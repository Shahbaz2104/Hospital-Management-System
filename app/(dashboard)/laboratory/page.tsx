import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { LaboratoryPage } from "@/components/features/diagnostics/laboratory-page";

export const metadata: Metadata = { title: "Laboratory" };

export default async function LaboratoryPageRoute() {
  await requirePermission("laboratory:read");
  return <LaboratoryPage />;
}
