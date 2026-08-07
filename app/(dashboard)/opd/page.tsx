import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { OpdQueue } from "@/components/features/opd/opd-queue";

export const metadata: Metadata = { title: "OPD Queue" };

export default async function OpdQueuePage() {
  await requirePermission("appointments:read");
  return <OpdQueue />;
}
