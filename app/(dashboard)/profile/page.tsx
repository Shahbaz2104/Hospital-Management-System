import type { Metadata } from "next";

import { requireSession } from "@/lib/auth/guards";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileClient } from "@/components/features/profile/profile-client";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireSession();

  return (
    <div>
      <PageHeader title="Profile" description="Your account and security" />
      <ProfileClient user={user} />
    </div>
  );
}