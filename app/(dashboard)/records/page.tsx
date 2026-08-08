import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { RecordsPage } from "@/components/features/records/records-page";

export const metadata: Metadata = { title: "Medical Records" };

export default async function RecordsPageRoute() {
  await requirePermission("records:read");
  return <RecordsPage />;
}
