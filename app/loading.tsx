export default function RootLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="space-y-3 text-center">
        <div className="mx-auto size-8 animate-pulse rounded-full bg-primary/20" />
        <p className="text-sm text-muted-foreground">
          Loading hospital workspace…
        </p>
      </div>
    </div>
  );
}