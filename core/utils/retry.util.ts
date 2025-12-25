/**
 * Retry Utility with Exponential Backoff
 *
 * Enterprise-grade retry mechanism:
 * - Exponential backoff
 * - Jitter to prevent thundering herd
 * - Circuit breaker pattern
 * - Configurable retry policies
 */

import { logger } from "../services/logger.service";
import { metrics } from "../services/metrics.service";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  timeout?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
}

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 10000, // 10 seconds
      ...options,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout!) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await fn();

      if (this.state === CircuitState.HALF_OPEN) {
        this.successCount++;
        if (this.successCount >= 3) {
          this.state = CircuitState.CLOSED;
          this.failures = 0;
        }
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.options.failureThreshold!) {
        this.state = CircuitState.OPEN;
        logger.warn("Circuit breaker opened", {
          metadata: { failures: this.failures },
        });
      }

      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successCount = 0;
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true,
    timeout,
    retryableErrors = [],
    onRetry,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const endTimer = metrics.startTimer("retry_attempt");

      let result: T;
      if (timeout) {
        result = await Promise.race([
          fn(),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), timeout)
          ),
        ]);
      } else {
        result = await fn();
      }

      endTimer();
      metrics.incrementCounter("retry_success", 1, {
        attempt: attempt.toString(),
      });

      return result;
    } catch (error) {
      lastError = error as Error;

      logger.warn(`Retry attempt ${attempt} failed`, {
        metadata: {
          attempt,
          maxAttempts,
          error: lastError.message,
        },
      });

      metrics.incrementCounter("retry_failure", 1, {
        attempt: attempt.toString(),
      });

      // Check if error is retryable
      if (
        retryableErrors.length > 0 &&
        !retryableErrors.includes(lastError.name)
      ) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Call onRetry callback
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Calculate delay with exponential backoff
      let currentDelay = Math.min(
        delay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      // Add jitter to prevent thundering herd
      if (jitter) {
        currentDelay = currentDelay * (0.5 + Math.random() * 0.5);
      }

      await sleep(currentDelay);
    }
  }

  logger.error("All retry attempts failed", lastError!, {
    metadata: { maxAttempts },
  });

  throw lastError!;
}

/**
 * Retry with circuit breaker
 */
export async function retryWithCircuitBreaker<T>(
  fn: () => Promise<T>,
  retryOptions: RetryOptions = {},
  circuitOptions: CircuitBreakerOptions = {}
): Promise<T> {
  const circuitBreaker = new CircuitBreaker(circuitOptions);

  return retry(() => circuitBreaker.execute(fn), retryOptions);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Timeout wrapper
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = "Operation timed out"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Batch operations
 */
export async function batch<T, R>(
  items: T[],
  batchSize: number,
  fn: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await fn(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Parallel execution with concurrency limit
 */
export async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = fn(item).then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}
