import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PayrollPage } from "@/components/features/hr/payroll-page";

export const metadata: Metadata = { title: "Payroll" };

export default async function PayrollPageRoute() {
  await requirePermission("payroll:read");
  return <PayrollPage />;
}
