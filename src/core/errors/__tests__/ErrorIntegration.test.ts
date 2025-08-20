import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ErrorHandler,
  SnippetLibraryError,
  ErrorLogger,
  RetryManager,
  ErrorRecoveryService,
  ErrorType,
  ErrorSeverity,
} from "../index";

describe("Error Handling Integration", () => {
  let errorHandler: ErrorHandler;
  let logger: ErrorLogger;

  beforeEach(() => {
    // Reset singletons for testing
    (ErrorHandler as any).instance = undefined;
    (ErrorLogger as any).instance = undefined;

    errorHandler = ErrorHandler.getInstance();
    logger = ErrorLogger.getInstance({
      logLevel: 0, // DEBUG
      maxLogEntries: 1000,
      enableConsoleLogging: false,
      enableFileLogging: false,
    });
  });

  describe("end-to-end error handling flow", () => {
    it("should handle complete error lifecycle", async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(
          SnippetLibraryError.network("Temporary network error")
        )
        .mockResolvedValue("success");

      const result = await errorHandler.executeWithErrorHandling(
        mockOperation,
        "test-operation",
        { component: "TestService", operation: "testMethod" },
        {
          maxRetries: 2,
          retryDelay: 10, // Fast retry for testing
          logErrors: true,
          autoRecover: true,
        }
      );

      // Should succeed after retry
      expect(result.success).toBe(true);
      expect(result.result).toBe("success");
      expect(result.retryResult?.attempts).toHaveLength(2);
      expect(mockOperation).toHaveBeenCalledTimes(2);

      // Should have logged the error
      const errorLogs = logger.getErrorLogs();
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    it("should handle non-recoverable errors without retry", async () => {
      const nonRecoverableError = new SnippetLibraryError(
        "Critical validation error",
        ErrorType.VALIDATION,
        ErrorSeverity.CRITICAL,
        { recoverable: false }
      );

      const mockOperation = vi.fn().mockRejectedValue(nonRecoverableError);

      const result = await errorHandler.executeWithErrorHandling(
        mockOperation,
        "test-operation",
        undefined,
        { maxRetries: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(nonRecoverableError);
      expect(mockOperation).toHaveBeenCalledTimes(1); // No retries
    });

    it("should attempt automatic recovery before retries", async () => {
      const recoveryService = new ErrorRecoveryService();
      const mockRecoveryAction = vi.fn().mockResolvedValue(undefined);

      // Add a custom recovery strategy
      recoveryService.addRecoveryStrategy({
        errorType: ErrorType.STORAGE_ACCESS,
        autoExecute: true,
        priority: 1,
        actions: [
          {
            id: "auto_fix_storage",
            label: "Auto Fix Storage",
            description: "Automatically fix storage issue",
            action: mockRecoveryAction,
            automatic: true,
          },
        ],
      });

      const storageError = SnippetLibraryError.storageAccess(
        "Storage access denied"
      );

      const result = await errorHandler.handleError(storageError, undefined, {
        autoRecover: true,
      });

      // Recovery should be attempted but fail (mock throws error)
      expect(result.recoveryAttempted).toBe(true);
      expect(result.recoveryResult?.success).toBe(false);
    });
  });

  describe("error propagation and context", () => {
    it("should maintain error context through the handling chain", async () => {
      const originalError = new Error("Original system error");
      const context = {
        component: "SnippetManager",
        operation: "createSnippet",
        additionalData: { snippetId: "test-123" },
      };

      const result = await errorHandler.handleError(originalError, context);

      expect(result.error).toBeInstanceOf(SnippetLibraryError);
      expect(result.error?.originalError).toBe(originalError);

      // Check that error was logged with context
      const errorLogs = logger.getErrorLogs();
      const lastLog = errorLogs[errorLogs.length - 1];
      expect(lastLog.context).toEqual(context);
    });

    it("should chain multiple error transformations", async () => {
      const systemError = new Error("System error");
      const snippetError = SnippetLibraryError.storageAccess(
        "Storage wrapper error",
        { path: "/test" },
        systemError
      );

      const result = await errorHandler.handleError(snippetError);

      expect(result.error).toBe(snippetError);
      expect(result.error?.originalError).toBe(systemError);
      expect(result.error?.details).toEqual({ path: "/test" });
    });
  });

  describe("concurrent error handling", () => {
    it("should handle multiple concurrent errors", async () => {
      const errors = [
        SnippetLibraryError.network("Network error 1"),
        SnippetLibraryError.validation("Validation error 1"),
        SnippetLibraryError.storageAccess("Storage error 1"),
      ];

      const results = await Promise.all(
        errors.map((error) => errorHandler.handleError(error))
      );

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(false);
        expect(result.error).toBe(errors[index]);
      });

      // All errors should be logged
      const errorLogs = logger.getErrorLogs();
      expect(errorLogs.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle concurrent operations with retries", async () => {
      const operations = [
        vi
          .fn()
          .mockRejectedValueOnce(SnippetLibraryError.network("Network error"))
          .mockResolvedValue("success 1"),
        vi
          .fn()
          .mockRejectedValueOnce(SnippetLibraryError.network("Network error"))
          .mockResolvedValue("success 2"),
        vi
          .fn()
          .mockRejectedValueOnce(SnippetLibraryError.network("Network error"))
          .mockResolvedValue("success 3"),
      ];

      const results = await Promise.all(
        operations.map((op, index) =>
          errorHandler.executeWithErrorHandling(
            op,
            `operation-${index}`,
            undefined,
            { maxRetries: 2, retryDelay: 10 }
          )
        )
      );

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.result).toBe(`success ${index + 1}`);
      });
    });
  });

  describe("error recovery scenarios", () => {
    it("should handle storage recovery scenario", async () => {
      const recoveryService = new ErrorRecoveryService();
      let storageFixed = false;

      // Mock storage recovery action
      recoveryService.addRecoveryStrategy({
        errorType: ErrorType.STORAGE_ACCESS,
        autoExecute: true,
        priority: 1,
        actions: [
          {
            id: "create_storage_dir",
            label: "Create Storage Directory",
            description: "Create missing storage directory",
            action: async () => {
              storageFixed = true;
            },
            automatic: true,
          },
        ],
      });

      const storageError = SnippetLibraryError.storageAccess(
        "Storage directory not found"
      );

      const recoveryResult = await recoveryService.attemptRecovery(
        storageError
      );

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.actionExecuted).toBe("create_storage_dir");
      expect(storageFixed).toBe(true);
    });

    it("should handle network recovery with retry", async () => {
      let connectionAttempts = 0;
      const mockNetworkOperation = vi.fn().mockImplementation(() => {
        connectionAttempts++;
        if (connectionAttempts < 3) {
          throw SnippetLibraryError.network("Connection timeout");
        }
        return "connected";
      });

      const retryManager = RetryManager.forNetwork();
      const result = await retryManager.executeWithRetry(
        mockNetworkOperation,
        "connect-to-server"
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe("connected");
      expect(connectionAttempts).toBe(3);
    });
  });

  describe("error statistics and monitoring", () => {
    it("should track error patterns over time", async () => {
      // Generate various errors
      const errors = [
        SnippetLibraryError.network("Network error 1"),
        SnippetLibraryError.network("Network error 2"),
        SnippetLibraryError.validation("Validation error 1"),
        SnippetLibraryError.storageAccess("Storage error 1"),
        SnippetLibraryError.validation("Validation error 2"),
      ];

      for (const error of errors) {
        await errorHandler.handleError(error);
      }

      const stats = errorHandler.getErrorStats();

      expect(stats.total).toBe(5);
      expect(stats.byType[ErrorType.NETWORK]).toBe(2);
      expect(stats.byType[ErrorType.VALIDATION]).toBe(2);
      expect(stats.byType[ErrorType.STORAGE_ACCESS]).toBe(1);
      expect(stats.bySeverity[ErrorSeverity.MEDIUM]).toBe(4); // Network + Validation
      expect(stats.bySeverity[ErrorSeverity.HIGH]).toBe(1); // Storage
    });

    it("should provide recent error history", async () => {
      const errors = Array.from({ length: 15 }, (_, i) =>
        SnippetLibraryError.validation(`Error ${i + 1}`)
      );

      for (const error of errors) {
        await errorHandler.handleError(error);
      }

      const stats = errorHandler.getErrorStats();

      expect(stats.recent).toHaveLength(10); // Last 10 errors
      expect(stats.recent[0].error?.message).toBe("Error 6");
      expect(stats.recent[9].error?.message).toBe("Error 15");
    });
  });

  describe("performance under error conditions", () => {
    it("should handle high error volume efficiently", async () => {
      const startTime = Date.now();

      // Generate 100 errors quickly
      const errorPromises = Array.from({ length: 100 }, (_, i) =>
        errorHandler.handleError(
          SnippetLibraryError.validation(`Error ${i + 1}`)
        )
      );

      const results = await Promise.all(errorPromises);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second

      // Verify all errors were handled
      results.forEach((result) => {
        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(SnippetLibraryError);
      });
    });

    it("should maintain performance with retry operations", async () => {
      const fastFailingOperation = vi
        .fn()
        .mockRejectedValue(
          SnippetLibraryError.validation("Non-retryable error")
        );

      const startTime = Date.now();

      const result = await errorHandler.executeWithErrorHandling(
        fastFailingOperation,
        "fast-fail-operation",
        undefined,
        { maxRetries: 5 } // Should not retry validation errors
      );

      const endTime = Date.now();

      expect(result.success).toBe(false);
      expect(endTime - startTime).toBeLessThan(100); // Should fail fast
      expect(fastFailingOperation).toHaveBeenCalledTimes(1);
    });
  });
});
