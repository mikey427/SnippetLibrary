import { SnippetError, ErrorSeverity, ErrorContext } from "./ErrorTypes";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly message: string;
  readonly error?: SnippetError;
  readonly context?: ErrorContext;
  readonly metadata?: Record<string, any>;
}

export interface ErrorLoggerConfig {
  readonly logLevel: LogLevel;
  readonly maxLogEntries: number;
  readonly enableConsoleLogging: boolean;
  readonly enableFileLogging: boolean;
  readonly logFilePath?: string;
}

/**
 * Centralized error logging system
 */
export class ErrorLogger {
  private static instance: ErrorLogger;
  private logs: LogEntry[] = [];
  private config: ErrorLoggerConfig;

  private constructor(config: ErrorLoggerConfig) {
    this.config = config;
  }

  public static getInstance(config?: ErrorLoggerConfig): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger(
        config || {
          logLevel: LogLevel.INFO,
          maxLogEntries: 1000,
          enableConsoleLogging: true,
          enableFileLogging: false,
        }
      );
    }
    return ErrorLogger.instance;
  }

  /**
   * Log an error
   */
  public logError(
    error: SnippetError,
    context?: ErrorContext,
    metadata?: Record<string, any>
  ): void {
    const level = this.severityToLogLevel(error.severity);
    this.log(level, error.message, error, context, metadata);
  }

  /**
   * Log a warning
   */
  public logWarning(
    message: string,
    context?: ErrorContext,
    metadata?: Record<string, any>
  ): void {
    this.log(LogLevel.WARN, message, undefined, context, metadata);
  }

  /**
   * Log info
   */
  public logInfo(
    message: string,
    context?: ErrorContext,
    metadata?: Record<string, any>
  ): void {
    this.log(LogLevel.INFO, message, undefined, context, metadata);
  }

  /**
   * Log debug information
   */
  public logDebug(
    message: string,
    context?: ErrorContext,
    metadata?: Record<string, any>
  ): void {
    this.log(LogLevel.DEBUG, message, undefined, context, metadata);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    error?: SnippetError,
    context?: ErrorContext,
    metadata?: Record<string, any>
  ): void {
    if (level < this.config.logLevel) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      error,
      context,
      metadata,
    };

    // Add to in-memory logs
    this.logs.push(logEntry);

    // Maintain max log entries
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(-this.config.maxLogEntries);
    }

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(logEntry);
    }

    // File logging (if enabled and in Node.js environment)
    if (this.config.enableFileLogging && this.config.logFilePath) {
      this.logToFile(logEntry);
    }
  }

  /**
   * Log to console with appropriate level
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level];
    const prefix = `[${timestamp}] [${levelStr}]`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.error, entry.context);
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.context);
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.error, entry.context);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, entry.message, entry.error, entry.context);
        if (entry.error?.stack) {
          console.error("Stack trace:", entry.error.stack);
        }
        break;
    }
  }

  /**
   * Log to file (Node.js environment only)
   */
  private async logToFile(entry: LogEntry): Promise<void> {
    try {
      // Only attempt file logging in Node.js environment
      if (typeof window === "undefined" && this.config.logFilePath) {
        const fs = await import("fs");
        const logLine =
          JSON.stringify({
            timestamp: entry.timestamp.toISOString(),
            level: LogLevel[entry.level],
            message: entry.message,
            error: entry.error?.toJSON(),
            context: entry.context,
            metadata: entry.metadata,
          }) + "\n";

        fs.appendFileSync(this.config.logFilePath, logLine);
      }
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  /**
   * Convert error severity to log level
   */
  private severityToLogLevel(severity: ErrorSeverity): LogLevel {
    switch (severity) {
      case ErrorSeverity.LOW:
        return LogLevel.INFO;
      case ErrorSeverity.MEDIUM:
        return LogLevel.WARN;
      case ErrorSeverity.HIGH:
        return LogLevel.ERROR;
      case ErrorSeverity.CRITICAL:
        return LogLevel.FATAL;
      default:
        return LogLevel.ERROR;
    }
  }

  /**
   * Get recent log entries
   */
  public getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get logs by level
   */
  public getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Get error logs only
   */
  public getErrorLogs(): LogEntry[] {
    return this.logs.filter((log) => log.error !== undefined);
  }

  /**
   * Clear all logs
   */
  public clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Update logger configuration
   */
  public updateConfig(config: Partial<ErrorLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
