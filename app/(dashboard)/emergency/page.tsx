import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { EmergencyPage } from "@/components/features/emergency/emergency-page";

export const metadata: Metadata = { title: "Emergency" };

export default async function EmergencyPageRoute() {
  await requirePermission("emergency:read");
  return <EmergencyPage />;
}
