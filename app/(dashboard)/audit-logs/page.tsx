import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { AuditLogsPage } from "@/components/features/audit/audit-logs-page";

export const metadata: Metadata = { title: "Audit Logs" };

export default async function AuditLogsRoute() {
  await requirePermission("audit:read");
  return <AuditLogsPage />;
}