import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { NotificationsPage } from "@/components/features/notifications/notifications-page";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPageRoute() {
  await requirePermission("notifications:read");
  return <NotificationsPage />;
}
