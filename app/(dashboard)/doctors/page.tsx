import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/shared/page-header";
import { DoctorsPage } from "@/components/features/doctors/doctors-page";

export const metadata: Metadata = { title: "Doctors" };

export default async function DoctorsPageRoute() {
  const user = await requirePermission("doctors:read");

  return (
    <div>
      <PageHeader
        title="Doctors"
        description={`${user.firstName}, manage clinical staff`}
      />
      <DoctorsPage />
    </div>
  );
}