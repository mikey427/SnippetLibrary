import { describe, it, expect } from "vitest";
import { SnippetLibraryError } from "../SnippetLibraryError";
import { ErrorType, ErrorSeverity } from "../ErrorTypes";

describe("SnippetLibraryError", () => {
  describe("constructor", () => {
    it("should create error with basic properties", () => {
      const error = new SnippetLibraryError(
        "Test error",
        ErrorType.VALIDATION,
        ErrorSeverity.MEDIUM
      );

      expect(error.message).toBe("Test error");
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.recoverable).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it("should create error with custom options", () => {
      const originalError = new Error("Original error");
      const context = { userId: "123" };

      const error = new SnippetLibraryError(
        "Test error",
        ErrorType.STORAGE_ACCESS,
        ErrorSeverity.HIGH,
        {
          code: "CUSTOM_CODE",
          details: { path: "/test" },
          recoverable: false,
          suggestedAction: "Try again",
          context,
          originalError,
        }
      );

      expect(error.code).toBe("CUSTOM_CODE");
      expect(error.details).toEqual({ path: "/test" });
      expect(error.recoverable).toBe(false);
      expect(error.suggestedAction).toBe("Try again");
      expect(error.context).toBe(context);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe("static factory methods", () => {
    it("should create storage access error", () => {
      const error = SnippetLibraryError.storageAccess("Cannot access file", {
        path: "/test",
      });

      expect(error.type).toBe(ErrorType.STORAGE_ACCESS);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.code).toBe("STORAGE_ACCESS_FAILED");
      expect(error.recoverable).toBe(true);
      expect(error.suggestedAction).toBe(
        "Check file permissions and storage location"
      );
    });

    it("should create validation error", () => {
      const error = SnippetLibraryError.validation("Invalid input", {
        field: "title",
      });

      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.code).toBe("VALIDATION_FAILED");
      expect(error.suggestedAction).toBe(
        "Please check the input data and try again"
      );
    });

    it("should create sync conflict error", () => {
      const error = SnippetLibraryError.syncConflict("Sync conflict detected", {
        conflictId: "abc123",
      });

      expect(error.type).toBe(ErrorType.SYNC_CONFLICT);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.code).toBe("SYNC_CONFLICT");
    });

    it("should create network error", () => {
      const originalError = new Error("Connection failed");
      const error = SnippetLibraryError.network(
        "Network request failed",
        { url: "http://localhost:3000" },
        originalError
      );

      expect(error.type).toBe(ErrorType.NETWORK);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.code).toBe("NETWORK_ERROR");
      expect(error.originalError).toBe(originalError);
    });

    it("should create import/export error", () => {
      const error = SnippetLibraryError.importExport("Import failed", {
        format: "json",
      });

      expect(error.type).toBe(ErrorType.IMPORT_EXPORT);
      expect(error.code).toBe("IMPORT_EXPORT_FAILED");
    });

    it("should create search error", () => {
      const error = SnippetLibraryError.search("Search failed", {
        query: "test",
      });

      expect(error.type).toBe(ErrorType.SEARCH);
      expect(error.severity).toBe(ErrorSeverity.LOW);
    });

    it("should create snippet operation error", () => {
      const error = SnippetLibraryError.snippetOperation("Operation failed", {
        operation: "create",
      });

      expect(error.type).toBe(ErrorType.SNIPPET_OPERATION);
      expect(error.code).toBe("SNIPPET_OPERATION_FAILED");
    });

    it("should create configuration error", () => {
      const error = SnippetLibraryError.configuration("Config error", {
        setting: "storage",
      });

      expect(error.type).toBe(ErrorType.CONFIGURATION);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe("toJSON", () => {
    it("should serialize error to JSON", () => {
      const error = new SnippetLibraryError(
        "Test error",
        ErrorType.VALIDATION,
        ErrorSeverity.MEDIUM,
        {
          code: "TEST_CODE",
          details: { field: "test" },
          context: { userId: "123" },
        }
      );

      const json = error.toJSON();

      expect(json.name).toBe("SnippetLibraryError");
      expect(json.message).toBe("Test error");
      expect(json.type).toBe(ErrorType.VALIDATION);
      expect(json.severity).toBe(ErrorSeverity.MEDIUM);
      expect(json.code).toBe("TEST_CODE");
      expect(json.details).toEqual({ field: "test" });
      expect(json.context).toEqual({ userId: "123" });
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
    });
  });

  describe("error inheritance", () => {
    it("should be instance of Error", () => {
      const error = new SnippetLibraryError("Test error", ErrorType.VALIDATION);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SnippetLibraryError);
    });

    it("should have proper error name", () => {
      const error = new SnippetLibraryError("Test error", ErrorType.VALIDATION);

      expect(error.name).toBe("SnippetLibraryError");
    });

    it("should maintain stack trace", () => {
      const error = new SnippetLibraryError("Test error", ErrorType.VALIDATION);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("SnippetLibraryError.test.ts");
    });
  });
});
