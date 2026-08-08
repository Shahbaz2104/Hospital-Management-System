import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { HrPage } from "@/components/features/hr/hr-page";

export const metadata: Metadata = { title: "HR" };

export default async function HrPageRoute() {
  await requirePermission("hr:read");
  return <HrPage />;
}
