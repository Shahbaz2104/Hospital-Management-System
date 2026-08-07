import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PharmacyPage } from "@/components/features/pharmacy/pharmacy-page";

export const metadata: Metadata = { title: "Pharmacy" };

export default async function PharmacyPageRoute() {
  await requirePermission("pharmacy:read");
  return <PharmacyPage />;
}
