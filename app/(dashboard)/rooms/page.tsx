import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { RoomsPage } from "@/components/features/rooms/rooms-page";

export const metadata: Metadata = { title: "Rooms & Beds" };

export default async function RoomsPageRoute() {
  await requirePermission("rooms:read");
  return <RoomsPage />;
}