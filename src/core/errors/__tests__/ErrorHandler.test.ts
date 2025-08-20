import { describe, it, expect, beforeEach, vi } from "vitest";
import { ErrorHandler } from "../ErrorHandler";
import { SnippetLibraryError } from "../SnippetLibraryError";
import { ErrorType, ErrorSeverity } from "../ErrorTypes";

describe("ErrorHandler", () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    // Reset singleton instance for testing
    (ErrorHandler as any).instance = undefined;
    errorHandler = ErrorHandler.getInstance();
  });

  describe("singleton pattern", () => {
    it("should return same instance", () => {
      const handler1 = ErrorHandler.getInstance();
      const handler2 = ErrorHandler.getInstance();

      expect(handler1).toBe(handler2);
    });
  });

  describe("error handling", () => {
    it("should handle SnippetLibraryError", async () => {
      const error = SnippetLibraryError.validation("Validation failed");

      const result = await errorHandler.handleError(error);

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.recoveryAttempted).toBe(false);
    });

    it("should normalize regular Error", async () => {
      const regularError = new Error("Regular error");

      const result = await errorHandler.handleError(regularError);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SnippetLibraryError);
      expect(result.error?.message).toBe("Regular error");
    });

    it("should normalize string errors", async () => {
      const result = await errorHandler.handleError("String error");

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SnippetLibraryError);
      expect(result.error?.message).toBe("String error");
    });

    it("should handle unknown error types", async () => {
      const result = await errorHandler.handleError({ unknown: "object" });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SnippetLibraryError);
      expect(result.error?.message).toBe("Unknown error occurred");
    });
  });

  describe("operation execution with error handling", () => {
    it("should execute successful operation", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await errorHandler.executeWithErrorHandling(
        operation,
        "test-operation"
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe("success");
      expect(result.recoveryAttempted).toBe(false);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should handle operation failure", async () => {
      const error = SnippetLibraryError.validation("Operation failed");
      const operation = vi.fn().mockRejectedValue(error);

      const result = await errorHandler.executeWithErrorHandling(
        operation,
        "test-operation"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should execute with retry on failure", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(SnippetLibraryError.network("Network error"))
        .mockResolvedValue("success");

      const result = await errorHandler.executeWithErrorHandling(
        operation,
        "test-operation",
        undefined,
        { maxRetries: 2 }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe("success");
      expect(result.retryResult).toBeDefined();
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should handle retry exhaustion", async () => {
      const error = SnippetLibraryError.network("Network error");
      const operation = vi.fn().mockRejectedValue(error);

      const result = await errorHandler.executeWithErrorHandling(
        operation,
        "test-operation",
        undefined,
        { maxRetries: 2 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.retryResult).toBeDefined();
      expect(result.retryResult?.success).toBe(false);
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe("synchronous error handling", () => {
    it("should handle sync errors", () => {
      const error = SnippetLibraryError.validation("Sync error");

      const result = errorHandler.handleSyncError(error);

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.recoveryAttempted).toBe(false);
    });
  });

  describe("error utilities", () => {
    it("should get user-friendly message", () => {
      const error = SnippetLibraryError.storageAccess("Storage error");

      const message = errorHandler.getUserFriendlyMessage(error);

      expect(message).toContain("Storage error");
      expect(message).toContain("Suggested action");
    });

    it("should get recovery actions", () => {
      const error = SnippetLibraryError.storageAccess("Storage error");

      const actions = errorHandler.getRecoveryActions(error);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((action) => action.id === "check_permissions")).toBe(
        true
      );
    });

    it("should execute recovery action", async () => {
      const error = SnippetLibraryError.storageAccess("Storage error");

      // This will fail because it's a mock action, but we can test the flow
      const result = await errorHandler.executeRecoveryAction(
        error,
        "check_permissions"
      );

      expect(result.success).toBe(false); // Mock action throws error
      expect(result.actionExecuted).toBe("check_permissions");
    });

    it("should create error context", () => {
      const context = errorHandler.createContext(
        "TestComponent",
        "testOperation",
        { userId: "123" }
      );

      expect(context.component).toBe("TestComponent");
      expect(context.operation).toBe("testOperation");
      expect(context.additionalData).toEqual({ userId: "123" });
    });
  });

  describe("error classification", () => {
    it("should identify critical errors", () => {
      const criticalError = new SnippetLibraryError(
        "Critical error",
        ErrorType.CONFIGURATION,
        ErrorSeverity.CRITICAL
      );

      expect(errorHandler.isCriticalError(criticalError)).toBe(true);
    });

    it("should identify non-critical errors", () => {
      const normalError = SnippetLibraryError.validation("Normal error");

      expect(errorHandler.isCriticalError(normalError)).toBe(false);
    });

    it("should identify recoverable errors", () => {
      const recoverableError = SnippetLibraryError.network("Network error");

      expect(errorHandler.isRecoverableError(recoverableError)).toBe(true);
    });

    it("should identify non-recoverable errors", () => {
      const nonRecoverableError = new SnippetLibraryError(
        "Non-recoverable error",
        ErrorType.VALIDATION,
        ErrorSeverity.MEDIUM,
        { recoverable: false }
      );

      expect(errorHandler.isRecoverableError(nonRecoverableError)).toBe(false);
    });
  });

  describe("error statistics", () => {
    it("should provide error statistics", async () => {
      // Generate some errors
      await errorHandler.handleError(SnippetLibraryError.validation("Error 1"));
      await errorHandler.handleError(SnippetLibraryError.network("Error 2"));
      await errorHandler.handleError(
        SnippetLibraryError.storageAccess("Error 3")
      );

      const stats = errorHandler.getErrorStats();

      expect(stats.total).toBe(3);
      expect(stats.bySeverity).toBeDefined();
      expect(stats.byType).toBeDefined();
      expect(stats.recent).toHaveLength(3);
    });

    it("should group errors by severity", async () => {
      await errorHandler.handleError(
        SnippetLibraryError.validation("Medium error")
      );
      await errorHandler.handleError(
        SnippetLibraryError.storageAccess("High error")
      );

      const stats = errorHandler.getErrorStats();

      expect(stats.bySeverity[ErrorSeverity.MEDIUM]).toBe(1);
      expect(stats.bySeverity[ErrorSeverity.HIGH]).toBe(1);
    });

    it("should group errors by type", async () => {
      await errorHandler.handleError(
        SnippetLibraryError.validation("Validation error")
      );
      await errorHandler.handleError(
        SnippetLibraryError.network("Network error")
      );
      await errorHandler.handleError(
        SnippetLibraryError.network("Another network error")
      );

      const stats = errorHandler.getErrorStats();

      expect(stats.byType[ErrorType.VALIDATION]).toBe(1);
      expect(stats.byType[ErrorType.NETWORK]).toBe(2);
    });
  });

  describe("error handling options", () => {
    it("should respect logErrors option", async () => {
      const error = SnippetLibraryError.validation("Test error");

      // This test would need to mock the logger to verify logging behavior
      const result = await errorHandler.handleError(error, undefined, {
        logErrors: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });

    it("should respect autoRecover option", async () => {
      const error = SnippetLibraryError.network("Network error");

      const result = await errorHandler.handleError(error, undefined, {
        autoRecover: false,
      });

      expect(result.success).toBe(false);
      expect(result.recoveryAttempted).toBe(false);
    });
  });
});
