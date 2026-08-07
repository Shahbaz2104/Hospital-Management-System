import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { DepartmentsPage } from "@/components/features/departments/departments-page";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPageRoute() {
  await requirePermission("departments:read");
  return <DepartmentsPage />;
}