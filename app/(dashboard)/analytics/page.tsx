import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { AnalyticsPage } from "@/components/features/analytics/analytics-page";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPageRoute() {
  await requirePermission("analytics:read");
  return <AnalyticsPage />;
}
