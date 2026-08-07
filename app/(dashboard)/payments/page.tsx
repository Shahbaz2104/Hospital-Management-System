import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PaymentsPage } from "@/components/features/billing/payments-page";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPageRoute() {
  await requirePermission("payments:read");
  return <PaymentsPage />;
}
