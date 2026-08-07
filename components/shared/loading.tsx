import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonStat() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-7 w-14" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-40" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-4"
            style={{ opacity: 1 - i * 0.12 }}
          >
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <SkeletonStats count={4} />
      <SkeletonTableRows rows={5} />
    </div>
  );
}