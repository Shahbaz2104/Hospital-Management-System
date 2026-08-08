import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { SettingsPage } from "@/components/features/settings/settings-page";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPageRoute() {
  await requirePermission("settings:manage");
  return <SettingsPage />;
}
