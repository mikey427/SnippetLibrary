import { describe, it, expect, beforeEach, vi } from "vitest";
import { ErrorLogger, LogLevel } from "../ErrorLogger";
import { SnippetLibraryError } from "../SnippetLibraryError";
import { ErrorType, ErrorSeverity } from "../ErrorTypes";

describe("ErrorLogger", () => {
  let logger: ErrorLogger;

  beforeEach(() => {
    // Reset singleton instance for testing
    (ErrorLogger as any).instance = undefined;
    logger = ErrorLogger.getInstance({
      logLevel: LogLevel.DEBUG,
      maxLogEntries: 100,
      enableConsoleLogging: false,
      enableFileLogging: false,
    });
  });

  describe("singleton pattern", () => {
    it("should return same instance", () => {
      const logger1 = ErrorLogger.getInstance();
      const logger2 = ErrorLogger.getInstance();

      expect(logger1).toBe(logger2);
    });
  });

  describe("logging methods", () => {
    it("should log error with proper level", () => {
      const error = SnippetLibraryError.validation("Test error");

      logger.logError(error);

      const logs = logger.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.WARN); // Medium severity maps to WARN
      expect(logs[0].error).toBe(error);
    });

    it("should log warning", () => {
      logger.logWarning("Test warning");

      const logs = logger.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[0].message).toBe("Test warning");
    });

    it("should log info", () => {
      logger.logInfo("Test info");

      const logs = logger.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.INFO);
      expect(logs[0].message).toBe("Test info");
    });

    it("should log debug", () => {
      logger.logDebug("Test debug");

      const logs = logger.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.DEBUG);
      expect(logs[0].message).toBe("Test debug");
    });
  });

  describe("log level filtering", () => {
    beforeEach(() => {
      (ErrorLogger as any).instance = undefined;
      logger = ErrorLogger.getInstance({
        logLevel: LogLevel.WARN,
        maxLogEntries: 100,
        enableConsoleLogging: false,
        enableFileLogging: false,
      });
    });

    it("should filter logs below configured level", () => {
      logger.logDebug("Debug message");
      logger.logInfo("Info message");
      logger.logWarning("Warning message");

      const logs = logger.getRecentLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe("Warning message");
    });
  });

  describe("log management", () => {
    it("should maintain max log entries", () => {
      (ErrorLogger as any).instance = undefined;
      logger = ErrorLogger.getInstance({
        logLevel: LogLevel.DEBUG,
        maxLogEntries: 3,
        enableConsoleLogging: false,
        enableFileLogging: false,
      });

      logger.logInfo("Message 1");
      logger.logInfo("Message 2");
      logger.logInfo("Message 3");
      logger.logInfo("Message 4");

      const logs = logger.getRecentLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe("Message 2");
      expect(logs[2].message).toBe("Message 4");
    });

    it("should get logs by level", () => {
      logger.logInfo("Info message");
      logger.logWarning("Warning message");
      logger.logError(SnippetLibraryError.validation("Error message"));

      const warnLogs = logger.getLogsByLevel(LogLevel.WARN);
      expect(warnLogs).toHaveLength(2); // Warning + Error (validation maps to WARN)
    });

    it("should get error logs only", () => {
      logger.logInfo("Info message");
      logger.logError(SnippetLibraryError.validation("Error message"));

      const errorLogs = logger.getErrorLogs();
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].error).toBeDefined();
    });

    it("should clear logs", () => {
      logger.logInfo("Message 1");
      logger.logInfo("Message 2");

      logger.clearLogs();

      const logs = logger.getRecentLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe("severity to log level mapping", () => {
    it("should map LOW severity to INFO", () => {
      const error = new SnippetLibraryError(
        "Test error",
        ErrorType.SEARCH,
        ErrorSeverity.LOW
      );

      logger.logError(error);

      const logs = logger.getRecentLogs(1);
      expect(logs[0].level).toBe(LogLevel.INFO);
    });

    it("should map MEDIUM severity to WARN", () => {
      const error = new SnippetLibraryError(
        "Test error",
        ErrorType.VALIDATION,
        ErrorSeverity.MEDIUM
      );

      logger.logError(error);

      const logs = logger.getRecentLogs(1);
      expect(logs[0].level).toBe(LogLevel.WARN);
    });

    it("should map HIGH severity to ERROR", () => {
      const error = new SnippetLibraryError(
        "Test error",
        ErrorType.STORAGE_ACCESS,
        ErrorSeverity.HIGH
      );

      logger.logError(error);

      const logs = logger.getRecentLogs(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
    });

    it("should map CRITICAL severity to FATAL", () => {
      const error = new SnippetLibraryError(
        "Test error",
        ErrorType.CONFIGURATION,
        ErrorSeverity.CRITICAL
      );

      logger.logError(error);

      const logs = logger.getRecentLogs(1);
      expect(logs[0].level).toBe(LogLevel.FATAL);
    });
  });

  describe("export functionality", () => {
    it("should export logs as JSON", () => {
      logger.logInfo("Test message");

      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].message).toBe("Test message");
    });
  });

  describe("configuration update", () => {
    it("should update configuration", () => {
      logger.updateConfig({ logLevel: LogLevel.ERROR });

      logger.logWarning("Warning message");
      logger.logError(SnippetLibraryError.validation("Error message"));

      const logs = logger.getRecentLogs();
      expect(logs).toHaveLength(1); // Only error should be logged
    });
  });

  describe("console logging", () => {
    beforeEach(() => {
      vi.spyOn(console, "debug").mockImplementation(() => {});
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("should log to console when enabled", () => {
      (ErrorLogger as any).instance = undefined;
      logger = ErrorLogger.getInstance({
        logLevel: LogLevel.DEBUG,
        maxLogEntries: 100,
        enableConsoleLogging: true,
        enableFileLogging: false,
      });

      logger.logDebug("Debug message");
      logger.logInfo("Info message");
      logger.logWarning("Warning message");
      logger.logError(SnippetLibraryError.validation("Error message"));

      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        "Debug message",
        undefined,
        undefined
      );
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]"),
        "Info message",
        undefined
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]"),
        "Warning message",
        expect.any(SnippetLibraryError),
        undefined
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]"),
        "Error message",
        expect.any(SnippetLibraryError),
        undefined
      );
    });
  });
});
