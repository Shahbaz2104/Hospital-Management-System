import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { NursesPage } from "@/components/features/nurses/nurses-page";

export const metadata: Metadata = { title: "Nurses" };

export default async function NursesPageRoute() {
  await requirePermission("nurses:read");
  return <NursesPage />;
}