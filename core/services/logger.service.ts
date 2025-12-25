/**
 * Production Logger Service
 *
 * Enterprise-grade logging with:
 * - Multiple log levels
 * - Structured logging
 * - Performance tracking
 * - Error context
 * - Remote logging support
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  stack?: string;
  performance?: {
    duration?: number;
    memory?: number;
  };
}

class LoggerService {
  private static instance: LoggerService;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private remoteLoggingEnabled = false;
  private remoteEndpoint?: string;

  private constructor() {
    // Set log level from environment
    const envLogLevel = process.env.NEXT_PUBLIC_LOG_LEVEL;
    if (envLogLevel) {
      this.logLevel =
        LogLevel[envLogLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
    }

    // Enable remote logging in production
    if (process.env.NODE_ENV === "production") {
      this.remoteLoggingEnabled = true;
      this.remoteEndpoint = process.env.NEXT_PUBLIC_LOG_ENDPOINT;
    }
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (error) {
      entry.error = error;
      entry.stack = error.stack;
    }

    // Add performance metrics if available
    if (typeof window !== "undefined" && window.performance) {
      entry.performance = {
        memory: (performance as any).memory?.usedJSHeapSize,
      };
    }

    return entry;
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.remoteLoggingEnabled || !this.remoteEndpoint) {
      return;
    }

    try {
      await fetch(this.remoteEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      // Fail silently for remote logging
      console.error("Failed to send log to remote:", error);
    }
  }

  private storeLog(entry: LogEntry): void {
    this.logs.push(entry);

    // Maintain max logs limit
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Send to remote if enabled
    if (this.remoteLoggingEnabled) {
      this.sendToRemote(entry).catch(() => {
        // Ignore remote logging errors
      });
    }
  }

  private formatConsoleOutput(entry: LogEntry): void {
    const levelColors = {
      [LogLevel.DEBUG]: "color: gray",
      [LogLevel.INFO]: "color: blue",
      [LogLevel.WARN]: "color: orange",
      [LogLevel.ERROR]: "color: red",
      [LogLevel.FATAL]: "color: red; font-weight: bold",
    };

    const levelNames = {
      [LogLevel.DEBUG]: "DEBUG",
      [LogLevel.INFO]: "INFO",
      [LogLevel.WARN]: "WARN",
      [LogLevel.ERROR]: "ERROR",
      [LogLevel.FATAL]: "FATAL",
    };

    console.log(
      `%c[${levelNames[entry.level]}] ${entry.timestamp}`,
      levelColors[entry.level],
      entry.message,
      entry.context || "",
      entry.error || ""
    );
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.storeLog(entry);
    this.formatConsoleOutput(entry);
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    this.storeLog(entry);
    this.formatConsoleOutput(entry);
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry = this.createLogEntry(LogLevel.WARN, message, context);
    this.storeLog(entry);
    this.formatConsoleOutput(entry);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error);
    this.storeLog(entry);
    this.formatConsoleOutput(entry);

    // Also log to console.error for stack traces
    if (error) {
      console.error(error);
    }
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.FATAL, message, context, error);
    this.storeLog(entry);
    this.formatConsoleOutput(entry);

    // Always log fatal errors
    console.error("FATAL ERROR:", message, error);
  }

  /**
   * Performance tracking
   */
  startTimer(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.info(`Performance: ${label}`, {
        metadata: { duration: `${duration.toFixed(2)}ms` },
      });
    };
  }

  /**
   * Get recent logs
   */
  getLogs(count = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = LoggerService.getInstance();
