/**
 * Error Utilities
 * Properly serialize errors for display and logging
 */

/**
 * Convert any error to a readable string message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    // Try to extract message from error object
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    // Try to stringify the error
    try {
      return JSON.stringify(error);
    } catch {
      return "An unknown error occurred";
    }
  }

  return "An unknown error occurred";
}

/**
 * Log error with proper serialization
 */
export function logError(context: string, error: unknown): void {
  const message = getErrorMessage(error);
  console.error(`[${context}]`, message);

  // Also log the full error object for debugging
  if (error instanceof Error && error.stack) {
    console.error("Stack trace:", error.stack);
  }
}

/**
 * Create user-friendly error message
 */
export function getUserFriendlyError(error: unknown): string {
  const message = getErrorMessage(error);

  // Map common errors to user-friendly messages
  if (message.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }

  if (message.includes("timeout")) {
    return "Request timed out. Please try again.";
  }

  if (message.includes("unauthorized") || message.includes("401")) {
    return "Authentication error. Please refresh the page.";
  }

  if (message.includes("not found") || message.includes("404")) {
    return "Resource not found. Please try again.";
  }

  if (message.includes("server") || message.includes("500")) {
    return "Server error. Please try again later.";
  }

  // Return the original message if no mapping found
  return message || "An unexpected error occurred. Please try again.";
}
