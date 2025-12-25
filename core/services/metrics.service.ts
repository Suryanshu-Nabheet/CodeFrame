/**
 * Metrics Collector Service
 *
 * Enterprise-grade metrics collection:
 * - Performance metrics
 * - User interactions
 * - Error rates
 * - Resource usage
 * - Custom events
 */

import { EventEmitter } from "events";

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  unit?: string;
}

export interface PerformanceMetric extends Metric {
  type: "performance";
  duration: number;
  memory?: number;
}

export interface CounterMetric extends Metric {
  type: "counter";
  increment: number;
}

export interface GaugeMetric extends Metric {
  type: "gauge";
  value: number;
}

export type AnyMetric = PerformanceMetric | CounterMetric | GaugeMetric;

class MetricsService extends EventEmitter {
  private static instance: MetricsService;
  private metrics: Map<string, AnyMetric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private timers: Map<string, number> = new Map();
  private enabled = true;

  private constructor() {
    super();

    // Enable metrics in production
    if (process.env.NODE_ENV === "production") {
      this.enabled = true;
    }

    // Start periodic flush
    if (typeof window !== "undefined") {
      setInterval(() => this.flush(), 60000); // Flush every minute
    }
  }

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Record a performance metric
   */
  recordPerformance(
    name: string,
    duration: number,
    tags?: Record<string, string>
  ): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      name,
      value: duration,
      timestamp: Date.now(),
      tags,
      unit: "ms",
      type: "performance",
      duration,
    };

    if (typeof window !== "undefined" && (performance as any).memory) {
      metric.memory = (performance as any).memory.usedJSHeapSize;
    }

    this.storeMetric(name, metric);
    this.emit("metric:performance", metric);
  }

  /**
   * Increment a counter
   */
  incrementCounter(
    name: string,
    value = 1,
    tags?: Record<string, string>
  ): void {
    if (!this.enabled) return;

    const currentValue = this.counters.get(name) || 0;
    const newValue = currentValue + value;
    this.counters.set(name, newValue);

    const metric: CounterMetric = {
      name,
      value: newValue,
      timestamp: Date.now(),
      tags,
      type: "counter",
      increment: value,
    };

    this.storeMetric(name, metric);
    this.emit("metric:counter", metric);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.enabled) return;

    this.gauges.set(name, value);

    const metric: GaugeMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
      type: "gauge",
    };

    this.storeMetric(name, metric);
    this.emit("metric:gauge", metric);
  }

  /**
   * Start a timer
   */
  startTimer(name: string): () => void {
    const start = performance.now();
    this.timers.set(name, start);

    return () => {
      const end = performance.now();
      const duration = end - start;
      this.recordPerformance(name, duration);
      this.timers.delete(name);
    };
  }

  /**
   * Track page view
   */
  trackPageView(path: string, metadata?: Record<string, any>): void {
    this.incrementCounter("page_view", 1, {
      path,
      ...metadata,
    });
  }

  /**
   * Track user action
   */
  trackAction(action: string, metadata?: Record<string, any>): void {
    this.incrementCounter("user_action", 1, {
      action,
      ...metadata,
    });
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.incrementCounter("error", 1, {
      errorType: error.name,
      errorMessage: error.message,
      ...context,
    });
  }

  /**
   * Track API call
   */
  trackAPICall(
    endpoint: string,
    method: string,
    duration: number,
    status: number
  ): void {
    this.recordPerformance("api_call", duration, {
      endpoint,
      method,
      status: status.toString(),
    });

    if (status >= 400) {
      this.incrementCounter("api_error", 1, {
        endpoint,
        method,
        status: status.toString(),
      });
    }
  }

  /**
   * Track WebContainer operation
   */
  trackWebContainerOp(
    operation: string,
    duration: number,
    success: boolean
  ): void {
    this.recordPerformance("webcontainer_op", duration, {
      operation,
      success: success.toString(),
    });

    if (!success) {
      this.incrementCounter("webcontainer_error", 1, { operation });
    }
  }

  /**
   * Track file operation
   */
  trackFileOp(operation: string, fileType: string, duration: number): void {
    this.recordPerformance("file_op", duration, {
      operation,
      fileType,
    });
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    performanceAvg: Record<string, number>;
  } {
    const performanceAvg: Record<string, number> = {};

    this.metrics.forEach((metrics, name) => {
      const perfMetrics = metrics.filter(
        (m) => m.type === "performance"
      ) as PerformanceMetric[];

      if (perfMetrics.length > 0) {
        const avg =
          perfMetrics.reduce((sum, m) => sum + m.duration, 0) /
          perfMetrics.length;
        performanceAvg[name] = avg;
      }
    });

    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      performanceAvg,
    };
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    const data = {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      metrics: Object.fromEntries(this.metrics),
      timestamp: Date.now(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.timers.clear();
  }

  private storeMetric(name: string, metric: AnyMetric): void {
    const existing = this.metrics.get(name) || [];
    existing.push(metric);

    // Keep last 1000 metrics per name
    if (existing.length > 1000) {
      existing.shift();
    }

    this.metrics.set(name, existing);
  }

  private async flush(): Promise<void> {
    if (!this.enabled) return;

    const endpoint = process.env.NEXT_PUBLIC_METRICS_ENDPOINT;
    if (!endpoint) return;

    try {
      const data = this.exportMetrics();
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: data,
      });
    } catch (error) {
      console.error("Failed to flush metrics:", error);
    }
  }
}

export const metrics = MetricsService.getInstance();
