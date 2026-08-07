import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/shared/page-header";
import { RoomsPage } from "@/components/features/rooms/rooms-page";

export const metadata: Metadata = { title: "Rooms & Beds" };

export default async function RoomsPageRoute() {
  const user = await requirePermission("rooms:read");

  return (
    <div>
      <PageHeader
        title="Rooms & Beds"
        description={`${user.firstName}, monitor inpatient capacity`}
      />
      <RoomsPage />
    </div>
  );
}