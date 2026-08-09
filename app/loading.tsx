export default function RootLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="space-y-4 text-center">
        <svg viewBox="0 0 96 24" aria-hidden className="mx-auto h-6 w-40 text-primary">
          <path
            d="M0 12h10l2 0 1.5-5 2 10 1.5-7 2 2h14l2 0 1.5-7 2 13 1.5-8 2 2h14l2 0 1.5-4 2 8 1.5-6 2 2h10l2 0 1.5-5 2 10 1.5-7 2 2h8"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Loading hospital workspace…
        </p>
      </div>
    </div>
  );
}
