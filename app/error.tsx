"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service (Sentry will be added later)
    console.error("Global application error:", error);

    // TODO: Send to error tracking service
    // if (typeof window !== 'undefined') {
    //   Sentry.captureException(error)
    // }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-destructive">Oops!</h1>
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground font-mono">
            {error.message || "An unexpected error occurred"}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex gap-4 justify-center">
          <Button onClick={() => reset()} variant="default">
            Try again
          </Button>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
          >
            Go home
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
