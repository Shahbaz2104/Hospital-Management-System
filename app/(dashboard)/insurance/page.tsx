import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { InsurancePage } from "@/components/features/billing/insurance-page";

export const metadata: Metadata = { title: "Insurance" };

export default async function InsurancePageRoute() {
  await requirePermission("insurance:read");
  return <InsurancePage />;
}
