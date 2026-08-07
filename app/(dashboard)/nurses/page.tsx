import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/shared/page-header";
import { NursesPage } from "@/components/features/nurses/nurses-page";

export const metadata: Metadata = { title: "Nurses" };

export default async function NursesPageRoute() {
  const user = await requirePermission("nurses:read");

  return (
    <div>
      <PageHeader
        title="Nurses"
        description={`${user.firstName}, manage nursing staff`}
      />
      <NursesPage />
    </div>
  );
}