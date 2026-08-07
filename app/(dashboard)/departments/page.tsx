import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/shared/page-header";
import { DepartmentsPage } from "@/components/features/departments/departments-page";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPageRoute() {
  const user = await requirePermission("departments:read");

  return (
    <div>
      <PageHeader
        title="Departments"
        description={`${user.firstName}, manage hospital departments`}
      />
      <DepartmentsPage />
    </div>
  );
}