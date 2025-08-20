import { describe, it, expect, beforeEach, vi } from "vitest";
import { RetryManager } from "../RetryManager";
import { SnippetLibraryError } from "../SnippetLibraryError";
import { ErrorType } from "../ErrorTypes";

describe("RetryManager", () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager({
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
      exponentialBackoff: true,
      retryableErrors: [ErrorType.NETWORK, ErrorType.STORAGE_ACCESS],
      jitter: false, // Disable jitter for predictable tests
    });
  });

  describe("successful operations", () => {
    it("should return result on first attempt", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await retryManager.executeWithRetry(
        operation,
        "test-operation"
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe("success");
      expect(result.attempts).toHaveLength(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe("retryable errors", () => {
    it("should retry on retryable errors", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(SnippetLibraryError.network("Network error"))
        .mockRejectedValueOnce(SnippetLibraryError.network("Network error"))
        .mockResolvedValue("success");

      const result = await retryManager.executeWithRetry(
        operation,
        "test-operation"
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe("success");
      expect(result.attempts).toHaveLength(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should fail after max retries", async () => {
      const networkError = SnippetLibraryError.network("Network error");
      const operation = vi.fn().mockRejectedValue(networkError);

      const result = await retryManager.executeWithRetry(
        operation,
        "test-operation"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(networkError);
      expect(result.attempts).toHaveLength(4); // Initial + 3 retries
      expect(operation).toHaveBeenCalledTimes(4);
    });
  });

  describe("non-retryable errors", () => {
    it("should not retry on non-retryable errors", async () => {
      const validationError =
        SnippetLibraryError.validation("Validation error");
      const operation = vi.fn().mockRejectedValue(validationError);

      const result = await retryManager.executeWithRetry(
        operation,
        "test-operation"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(validationError);
      expect(result.attempts).toHaveLength(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should not retry on non-recoverable errors", async () => {
      const nonRecoverableError = new SnippetLibraryError(
        "Non-recoverable error",
        ErrorType.NETWORK,
        undefined,
        { recoverable: false }
      );
      const operation = vi.fn().mockRejectedValue(nonRecoverableError);

      const result = await retryManager.executeWithRetry(
        operation,
        "test-operation"
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toHaveLength(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe("delay calculation", () => {
    it("should use exponential backoff", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(SnippetLibraryError.network("Network error"));

      const startTime = Date.now();
      await retryManager.executeWithRetry(operation, "test-operation");
      const endTime = Date.now();

      // Should have delays: 100ms, 200ms, 400ms
      // Total minimum delay: 700ms
      expect(endTime - startTime).toBeGreaterThan(600);
    });

    it("should respect max delay", async () => {
      const retryManagerWithLowMax = new RetryManager({
        maxRetries: 10,
        initialDelay: 100,
        maxDelay: 200,
        exponentialBackoff: true,
        retryableErrors: [ErrorType.NETWORK],
        jitter: false,
      });

      const operation = vi
        .fn()
        .mockRejectedValue(SnippetLibraryError.network("Network error"));

      const result = await retryManagerWithLowMax.executeWithRetry(
        operation,
        "test-operation"
      );

      // Check that delays don't exceed maxDelay
      result.attempts.forEach((attempt) => {
        if (attempt.delay > 0) {
          expect(attempt.delay).toBeLessThanOrEqual(200);
        }
      });
    });
  });

  describe("error normalization", () => {
    it("should normalize regular Error to SnippetLibraryError", async () => {
      const regularError = new Error("Regular error");
      const operation = vi.fn().mockRejectedValue(regularError);

      const result = await retryManager.executeWithRetry(
        operation,
        "test-operation"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SnippetLibraryError);
      expect(result.error?.message).toBe("Regular error");
    });

    it("should normalize string errors", async () => {
      const operation = vi.fn().mockRejectedValue("String error");

      const result = await retryManager.executeWithRetry(
        operation,
        "test-operation"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SnippetLibraryError);
      expect(result.error?.message).toBe("Unknown error occurred");
    });
  });

  describe("custom configuration", () => {
    it("should use custom retry configuration", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(SnippetLibraryError.network("Network error"));

      const result = await retryManager.executeWithRetry(
        operation,
        "test-operation",
        { maxRetries: 1 }
      );

      expect(result.attempts).toHaveLength(2); // Initial + 1 retry
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe("factory methods", () => {
    it("should create network retry manager", () => {
      const networkRetryManager = RetryManager.forNetwork();
      expect(networkRetryManager).toBeInstanceOf(RetryManager);
    });

    it("should create storage retry manager", () => {
      const storageRetryManager = RetryManager.forStorage();
      expect(storageRetryManager).toBeInstanceOf(RetryManager);
    });

    it("should create retry manager with custom config", () => {
      const customRetryManager = RetryManager.withConfig({
        maxRetries: 5,
        initialDelay: 500,
      });
      expect(customRetryManager).toBeInstanceOf(RetryManager);
    });
  });

  describe("attempt tracking", () => {
    it("should track all attempts with timestamps", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(SnippetLibraryError.network("Error 1"))
        .mockRejectedValueOnce(SnippetLibraryError.network("Error 2"))
        .mockResolvedValue("success");

      const result = await retryManager.executeWithRetry(
        operation,
        "test-operation"
      );

      expect(result.attempts).toHaveLength(3);

      // Check first attempt (failed)
      expect(result.attempts[0].attemptNumber).toBe(1);
      expect(result.attempts[0].error?.message).toBe("Error 1");
      expect(result.attempts[0].timestamp).toBeInstanceOf(Date);

      // Check second attempt (failed)
      expect(result.attempts[1].attemptNumber).toBe(2);
      expect(result.attempts[1].error?.message).toBe("Error 2");
      expect(result.attempts[1].delay).toBeGreaterThan(0);

      // Check third attempt (successful)
      expect(result.attempts[2].attemptNumber).toBe(3);
      expect(result.attempts[2].error).toBeUndefined();
    });

    it("should track total duration", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(SnippetLibraryError.network("Network error"))
        .mockResolvedValue("success");

      const result = await retryManager.executeWithRetry(
        operation,
        "test-operation"
      );

      expect(result.totalDuration).toBeGreaterThan(100); // At least one delay
      expect(typeof result.totalDuration).toBe("number");
    });
  });
});
