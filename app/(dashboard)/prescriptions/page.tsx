import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PrescriptionsPage } from "@/components/features/prescriptions/prescriptions-page";

export const metadata: Metadata = { title: "Prescriptions" };

export default async function PrescriptionsPageRoute() {
  await requirePermission("prescriptions:read");
  return <PrescriptionsPage />;
}
