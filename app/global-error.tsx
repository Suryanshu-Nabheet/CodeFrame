"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <h1 className="text-4xl font-bold text-red-600">Critical Error</h1>
            <p className="text-lg">
              A critical error occurred. Please refresh the page.
            </p>
            <div className="p-4 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-700 font-mono">
                {error.message || "Unknown error"}
              </p>
            </div>
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
