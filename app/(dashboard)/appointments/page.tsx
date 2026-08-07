import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { AppointmentsPage } from "@/components/features/appointments/appointments-page";

export const metadata: Metadata = { title: "Appointments" };

export default async function AppointmentsPageRoute() {
  await requirePermission("appointments:read");
  return <AppointmentsPage />;
}