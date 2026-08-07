import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { BillingPage } from "@/components/features/billing/billing-page";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPageRoute() {
  await requirePermission("billing:read");
  return <BillingPage />;
}
