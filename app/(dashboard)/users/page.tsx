import type { Metadata } from "next";

import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/shared/page-header";
import { UsersPage } from "@/components/features/users/users-page";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPageRoute() {
  const user = await requirePermission("users:read");

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${user.firstName}, manage hospital accounts and roles`}
      />
      <UsersPage />
    </div>
  );
}