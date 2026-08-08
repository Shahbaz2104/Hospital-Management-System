import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { StaffPage } from "@/components/features/hr/staff-page";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPageRoute() {
  await requirePermission("hr:read");
  return <StaffPage />;
}
