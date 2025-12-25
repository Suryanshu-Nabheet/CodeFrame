import { WebContainer } from "@webcontainer/api";
import { EventEmitter } from "events";
import { logger } from "./logger.service";
import { metrics } from "./metrics.service";
import { retry, retryWithCircuitBreaker } from "../utils/retry.util";

/**
 * Production-Grade WebContainerService
 *
 * Features:
 * - Singleton pattern with lifecycle management
 * - Retry logic with circuit breaker
 * - Performance monitoring
 * - Error tracking
 * - Health checks
 * - Graceful degradation
 * - Connection pooling for processes
 */

export interface WebContainerHealth {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  processCount: number;
  lastError?: string;
  lastErrorTime?: number;
}

export class WebContainerService extends EventEmitter {
  private static instance: WebContainerService | null = null;
  private container: WebContainer | null = null;
  private bootPromise: Promise<WebContainer> | null = null;
  private isBooting: boolean = false;
  private isReady: boolean = false;
  private previewUrl: string = "";
  private startTime: number = 0;
  private processPool: Map<string, any> = new Map();
  private healthStatus: WebContainerHealth = {
    status: "unhealthy",
    uptime: 0,
    processCount: 0,
  };

  private constructor() {
    super();
    logger.info("WebContainerService initialized");
  }

  static getInstance(): WebContainerService {
    if (!WebContainerService.instance) {
      WebContainerService.instance = new WebContainerService();
    }
    return WebContainerService.instance;
  }

  /**
   * Boot WebContainer with retry and circuit breaker
   */
  async boot(): Promise<WebContainer> {
    const endTimer = metrics.startTimer("webcontainer_boot");

    try {
      // If already booted, return existing instance
      if (this.container && this.isReady) {
        logger.debug("WebContainer already booted");
        return this.container;
      }

      // If currently booting, wait for existing boot promise
      if (this.isBooting && this.bootPromise) {
        logger.debug("WebContainer boot in progress, waiting...");
        return this.bootPromise;
      }

      // Start new boot process
      this.isBooting = true;
      this.emit("boot:start");
      logger.info("Starting WebContainer boot");

      this.bootPromise = this.performBootWithRetry();

      const container = await this.bootPromise;
      this.container = container;
      this.isReady = true;
      this.isBooting = false;
      this.startTime = Date.now();

      this.updateHealthStatus("healthy");
      this.emit("boot:complete", container);
      logger.info("WebContainer boot complete");
      metrics.incrementCounter("webcontainer_boot_success");

      endTimer();
      return container;
    } catch (error) {
      this.isBooting = false;
      this.bootPromise = null;
      this.updateHealthStatus("unhealthy", error as Error);
      this.emit("boot:error", error);

      logger.error("WebContainer boot failed", error as Error);
      metrics.incrementCounter("webcontainer_boot_failure");

      endTimer();
      throw error;
    }
  }

  /**
   * Perform boot with retry logic
   */
  private async performBootWithRetry(): Promise<WebContainer> {
    return retryWithCircuitBreaker(
      () => this.performBoot(),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        onRetry: (attempt, error) => {
          logger.warn(`WebContainer boot retry attempt ${attempt}`, {
            metadata: { error: error.message },
          });
        },
      },
      {
        failureThreshold: 3,
        resetTimeout: 60000,
      }
    );
  }

  /**
   * Actual boot implementation
   */
  private async performBoot(): Promise<WebContainer> {
    try {
      logger.debug("Booting WebContainer instance");
      const container = await WebContainer.boot();

      // Setup event listeners
      container.on("server-ready", (port, url) => {
        logger.info(`Server ready on port ${port}`, {
          metadata: { url },
        });
        this.previewUrl = url;
        this.emit("server:ready", { port, url });
        metrics.incrementCounter("server_ready");
      });

      container.on("port", (port, type, url) => {
        logger.debug(`Port ${port} ${type}`, {
          metadata: { url },
        });
        this.emit("port", { port, type, url });
      });

      container.on("error", (error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("WebContainer error", err);
        this.updateHealthStatus("degraded", err);
        this.emit("error", err);
        metrics.trackError(err, { source: "webcontainer" });
      });

      return container;
    } catch (error) {
      logger.error("WebContainer boot implementation failed", error as Error);
      throw new Error(
        `Failed to boot WebContainer: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get WebContainer instance
   */
  getContainer(): WebContainer | null {
    return this.container;
  }

  /**
   * Check if ready
   */
  isContainerReady(): boolean {
    return this.isReady && this.container !== null;
  }

  /**
   * Get preview URL
   */
  getPreviewUrl(): string {
    return this.previewUrl;
  }

  /**
   * Spawn process with retry and monitoring
   */
  async spawn(
    command: string,
    args: string[] = [],
    options?: { cwd?: string; env?: Record<string, string> }
  ) {
    const endTimer = metrics.startTimer("webcontainer_spawn");

    try {
      if (!this.container) {
        throw new Error("WebContainer not initialized. Call boot() first.");
      }

      logger.debug(`Spawning process: ${command}`, {
        metadata: { args, options },
      });

      const process = await retry(
        () => this.container!.spawn(command, args, options),
        {
          maxAttempts: 2,
          initialDelay: 500,
        }
      );

      this.processPool.set(`${command}-${Date.now()}`, process);
      this.updateHealthStatus("healthy");

      this.emit("process:spawn", { command, args, options });
      metrics.incrementCounter("process_spawn", 1, { command });

      endTimer();
      return process;
    } catch (error) {
      this.emit("process:error", { command, args, error });
      logger.error(`Failed to spawn process: ${command}`, error as Error);
      metrics.incrementCounter("process_spawn_error", 1, { command });

      endTimer();
      throw error;
    }
  }

  /**
   * Execute command and return output
   */
  async exec(
    command: string,
    args: string[] = []
  ): Promise<{ exitCode: number; output: string }> {
    const endTimer = metrics.startTimer("webcontainer_exec");

    try {
      if (!this.container) {
        throw new Error("WebContainer not initialized");
      }

      const process = await this.spawn(command, args);
      let output = "";

      process.output.pipeTo(
        new WritableStream({
          write(data) {
            output += data;
          },
        })
      );

      const exitCode = await process.exit;

      logger.debug(`Command executed: ${command}`, {
        metadata: { exitCode, outputLength: output.length },
      });

      metrics.trackWebContainerOp("exec", performance.now(), exitCode === 0);

      endTimer();
      return { exitCode, output };
    } catch (error) {
      logger.error(`Command execution failed: ${command}`, error as Error);
      metrics.trackWebContainerOp("exec", performance.now(), false);

      endTimer();
      throw error;
    }
  }

  /**
   * Get health status
   */
  getHealth(): WebContainerHealth {
    if (this.isReady && this.startTime) {
      this.healthStatus.uptime = Date.now() - this.startTime;
      this.healthStatus.processCount = this.processPool.size;
    }
    return { ...this.healthStatus };
  }

  /**
   * Update health status
   */
  private updateHealthStatus(
    status: "healthy" | "degraded" | "unhealthy",
    error?: Error
  ): void {
    this.healthStatus.status = status;

    if (error) {
      this.healthStatus.lastError = error.message;
      this.healthStatus.lastErrorTime = Date.now();
    }

    this.emit("health:change", this.healthStatus);

    metrics.setGauge("webcontainer_health", status === "healthy" ? 1 : 0);
  }

  /**
   * Teardown with cleanup
   */
  async teardown(): Promise<void> {
    const endTimer = metrics.startTimer("webcontainer_teardown");

    try {
      if (this.container) {
        logger.info("Tearing down WebContainer");

        // Clear process pool
        this.processPool.clear();

        await this.container.teardown();
        this.container = null;
        this.isReady = false;
        this.previewUrl = "";
        this.updateHealthStatus("unhealthy");

        this.emit("teardown:complete");
        logger.info("WebContainer teardown complete");
        metrics.incrementCounter("webcontainer_teardown");
      }

      endTimer();
    } catch (error) {
      this.emit("teardown:error", error);
      logger.error("WebContainer teardown failed", error as Error);

      endTimer();
      throw error;
    }
  }

  /**
   * Reset service (for testing/development)
   */
  static reset(): void {
    if (WebContainerService.instance) {
      WebContainerService.instance.teardown().catch((error) => {
        logger.error("Failed to teardown during reset", error);
      });
      WebContainerService.instance = null;
    }
  }
}

export const webContainerService = WebContainerService.getInstance();
