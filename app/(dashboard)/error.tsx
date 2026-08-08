"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDenied = /forbidden|unauthorized|permission/i.test(error.message);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="size-6 text-destructive" />
          </div>
          <CardTitle>
            {isDenied ? "You don't have access to this page" : "Something went wrong"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {isDenied
              ? "Your account doesn't have the required permission. Contact an administrator if you believe this is a mistake."
              : "An unexpected error occurred while loading this page. Try again, or head back to the dashboard."}
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground/60">
              Error digest: {error.digest}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button onClick={reset} variant="outline">
              Try again
            </Button>
            <Button asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
