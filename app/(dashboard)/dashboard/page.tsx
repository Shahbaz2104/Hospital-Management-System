import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { AnimatedText } from "@/components/motion/animated-text";
import { DashboardOverview } from "@/components/features/dashboard/dashboard-overview";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={<AnimatedText text="Dashboard" as="span" />}
        description="Hospital overview and today's activity"
      />
      <DashboardOverview />
    </div>
  );
}