import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { DoctorsPage } from "@/components/features/doctors/doctors-page";

export const metadata: Metadata = { title: "Doctors" };

export default async function DoctorsPageRoute() {
  await requirePermission("doctors:read");
  return <DoctorsPage />;
}