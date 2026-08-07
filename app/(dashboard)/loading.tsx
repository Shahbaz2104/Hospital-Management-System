import { SkeletonPage } from "@/components/shared/loading";

export default function DashboardLoading() {
  return (
    <div className="fade-in">
      <SkeletonPage />
    </div>
  );
}