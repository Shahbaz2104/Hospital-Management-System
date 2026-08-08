import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { ReportsPage } from "@/components/features/reports/reports-page";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPageRoute() {
  await requirePermission("reports:read");
  return <ReportsPage />;
}
