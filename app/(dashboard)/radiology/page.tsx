import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { RadiologyPage } from "@/components/features/diagnostics/radiology-page";

export const metadata: Metadata = { title: "Radiology" };

export default async function RadiologyPageRoute() {
  await requirePermission("radiology:read");
  return <RadiologyPage />;
}
