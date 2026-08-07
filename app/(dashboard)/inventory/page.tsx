import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { InventoryPage } from "@/components/features/inventory/inventory-page";

export const metadata: Metadata = { title: "Medicine Inventory" };

export default async function InventoryPageRoute() {
  await requirePermission("inventory:read");
  return <InventoryPage />;
}
