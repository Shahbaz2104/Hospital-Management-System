import Link from "next/link";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No internet connection right now. Reconnect and try again — the app
          shell stays available, but live data needs a connection.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
