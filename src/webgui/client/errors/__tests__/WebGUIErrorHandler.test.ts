import { describe, it, expect, beforeEach, vi } from "vitest";
import { WebGUIErrorHandler, ToastNotification } from "../WebGUIErrorHandler";
import {
  SnippetLibraryError,
  ErrorType,
  ErrorSeverity,
} from "../../../../core/errors";

// Mock navigator and window objects
Object.defineProperty(global, "navigator", {
  value: {
    userAgent: "Mozilla/5.0 (Test Browser)",
    platform: "Test Platform",
    language: "en-US",
    onLine: true,
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  },
  writable: true,
});

Object.defineProperty(global, "window", {
  value: {
    location: {
      href: "http://localhost:3000/test",
    },
  },
  writable: true,
});

// Mock document for file download
Object.defineProperty(global, "document", {
  value: {
    createElement: vi.fn().mockReturnValue({
      href: "",
      download: "",
      click: vi.fn(),
      style: {},
    }),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  },
  writable: true,
});

// Mock URL for blob creation
Object.defineProperty(global, "URL", {
  value: {
    createObjectURL: vi.fn().mockReturnValue("blob:test-url"),
    revokeObjectURL: vi.fn(),
  },
  writable: true,
});

// Mock Blob
Object.defineProperty(global, "Blob", {
  value: class MockBlob {
    constructor(public content: any[], public options: any) {}
  },
  writable: true,
});

describe("WebGUIErrorHandler", () => {
  let errorHandler: WebGUIErrorHandler;
  let mockToastCallback: ReturnType<typeof vi.fn>;
  let mockErrorBoundaryCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    errorHandler = new WebGUIErrorHandler();
    mockToastCallback = vi.fn();
    mockErrorBoundaryCallback = vi.fn();

    errorHandler.setToastCallback(mockToastCallback);
    errorHandler.setErrorBoundaryCallback(mockErrorBoundaryCallback);

    vi.clearAllMocks();
  });

  describe("toast notifications", () => {
    it("should show info toast for low severity errors", async () => {
      const error = new SnippetLibraryError(
        "Low severity error",
        ErrorType.SEARCH,
        ErrorSeverity.LOW
      );

      await errorHandler.handleError(error);

      expect(mockToastCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "info",
          title: "Search Error",
          message: "Low severity error",
          duration: 3000,
        })
      );
    });

    it("should show warning toast for medium severity errors", async () => {
      const error = SnippetLibraryError.validation("Validation error");

      await errorHandler.handleError(error);

      expect(mockToastCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          title: "Validation Error",
          message: "Validation error",
          duration: 5000,
        })
      );
    });

    it("should show error toast for high severity errors", async () => {
      const error = SnippetLibraryError.storageAccess("Storage error");

      await errorHandler.handleError(error);

      expect(mockToastCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Storage Error",
          message: "Storage error",
          duration: 8000,
          actions: expect.arrayContaining([
            expect.objectContaining({ label: "Show Details" }),
          ]),
        })
      );
    });

    it("should show persistent toast for critical errors", async () => {
      const error = new SnippetLibraryError(
        "Critical error",
        ErrorType.CONFIGURATION,
        ErrorSeverity.CRITICAL
      );

      await errorHandler.handleError(error);

      expect(mockToastCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Configuration Error",
          message: "Critical error",
          duration: 0,
          persistent: true,
        })
      );
    });

    it("should not show notification when disabled", async () => {
      const error = SnippetLibraryError.validation("Test error");

      await errorHandler.handleError(error, undefined, false);

      expect(mockToastCallback).not.toHaveBeenCalled();
    });

    it("should fall back to console when toast callback not set", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      errorHandler.setToastCallback(undefined as any);

      const error = SnippetLibraryError.validation("Test error");

      await errorHandler.handleError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Toast callback not set, falling back to console error:",
        error
      );

      consoleSpy.mockRestore();
    });
  });

  describe("error boundary integration", () => {
    it("should update error boundary for critical errors", async () => {
      const error = new SnippetLibraryError(
        "Critical error",
        ErrorType.CONFIGURATION,
        ErrorSeverity.CRITICAL
      );

      await errorHandler.handleError(error);

      expect(mockErrorBoundaryCallback).toHaveBeenCalledWith({
        hasError: true,
        error,
        errorId: expect.stringMatching(/^error-\d+$/),
      });
    });

    it("should not update error boundary for non-critical errors", async () => {
      const error = SnippetLibraryError.validation("Validation error");

      await errorHandler.handleError(error);

      expect(mockErrorBoundaryCallback).not.toHaveBeenCalled();
    });

    it("should clear error boundary", () => {
      errorHandler.clearErrorBoundary();

      expect(mockErrorBoundaryCallback).toHaveBeenCalledWith({
        hasError: false,
      });
    });
  });

  describe("operation execution with error handling", () => {
    it("should execute successful operation", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await errorHandler.executeWithWebGUIErrorHandling(
        operation,
        "test-operation"
      );

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should handle operation failure", async () => {
      const error = SnippetLibraryError.validation("Operation failed");
      const operation = vi.fn().mockRejectedValue(error);

      const result = await errorHandler.executeWithWebGUIErrorHandling(
        operation,
        "test-operation"
      );

      expect(result).toBeUndefined();
      expect(mockToastCallback).toHaveBeenCalled();
    });

    it("should return undefined on error without notification", async () => {
      const error = SnippetLibraryError.validation("Operation failed");
      const operation = vi.fn().mockRejectedValue(error);

      const result = await errorHandler.executeWithWebGUIErrorHandling(
        operation,
        "test-operation",
        undefined,
        false
      );

      expect(result).toBeUndefined();
      expect(mockToastCallback).not.toHaveBeenCalled();
    });
  });

  describe("error details and reporting", () => {
    it("should copy error to clipboard", async () => {
      const error = SnippetLibraryError.storageAccess("Storage error");

      await errorHandler.handleError(error);

      // Find and execute the "Show Details" action
      const toastCall = mockToastCallback.mock.calls[0][0] as ToastNotification;
      const showDetailsAction = toastCall.actions?.find(
        (a) => a.label === "Show Details"
      );

      expect(showDetailsAction).toBeDefined();

      // Execute the action (this will show details toast)
      showDetailsAction?.action();

      // Find the details toast and execute copy action
      const detailsToastCall = mockToastCallback.mock
        .calls[1][0] as ToastNotification;
      const copyAction = detailsToastCall.actions?.find(
        (a) => a.label === "Copy to Clipboard"
      );

      expect(copyAction).toBeDefined();

      // Execute copy action
      await copyAction?.action();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("# Snippet Library Error Report")
      );
    });

    it("should download error report", async () => {
      const mockLink = {
        href: "",
        download: "",
        click: vi.fn(),
        style: {},
      };
      (document.createElement as any).mockReturnValue(mockLink);

      const error = SnippetLibraryError.storageAccess("Storage error");

      await errorHandler.handleError(error);

      // Execute show details action
      const toastCall = mockToastCallback.mock.calls[0][0] as ToastNotification;
      const showDetailsAction = toastCall.actions?.find(
        (a) => a.label === "Show Details"
      );
      showDetailsAction?.action();

      // Execute download action
      const detailsToastCall = mockToastCallback.mock
        .calls[1][0] as ToastNotification;
      const downloadAction = detailsToastCall.actions?.find(
        (a) => a.label === "Download Report"
      );
      downloadAction?.action();

      expect(document.createElement).toHaveBeenCalledWith("a");
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toMatch(/^error-report-.*\.txt$/);
    });

    it("should format error report correctly", async () => {
      const error = new SnippetLibraryError(
        "Test error",
        ErrorType.STORAGE_ACCESS,
        ErrorSeverity.HIGH,
        {
          code: "TEST_CODE",
          details: { path: "/test" },
          context: { userId: "123" },
        }
      );

      await errorHandler.handleError(error);

      // Execute show details and copy actions
      const toastCall = mockToastCallback.mock.calls[0][0] as ToastNotification;
      const showDetailsAction = toastCall.actions?.find(
        (a) => a.label === "Show Details"
      );
      showDetailsAction?.action();

      const detailsToastCall = mockToastCallback.mock
        .calls[1][0] as ToastNotification;
      const copyAction = detailsToastCall.actions?.find(
        (a) => a.label === "Copy to Clipboard"
      );
      await copyAction?.action();

      const reportContent = (navigator.clipboard.writeText as any).mock
        .calls[0][0];

      expect(reportContent).toContain("# Snippet Library Error Report");
      expect(reportContent).toContain("Type: storage_access");
      expect(reportContent).toContain("Severity: high");
      expect(reportContent).toContain("Code: TEST_CODE");
      expect(reportContent).toContain("Message: Test error");
      expect(reportContent).toContain("User Agent: Mozilla/5.0 (Test Browser)");
      expect(reportContent).toContain('"path": "/test"');
      expect(reportContent).toContain('"userId": "123"');
    });
  });

  describe("recovery action execution", () => {
    it("should execute recovery action with progress feedback", async () => {
      const error = SnippetLibraryError.storageAccess("Storage error");

      await errorHandler.handleError(error);

      // Find and execute a recovery action
      const toastCall = mockToastCallback.mock.calls[0][0] as ToastNotification;
      const recoveryAction = toastCall.actions?.find(
        (a) => a.label !== "Show Details"
      );

      expect(recoveryAction).toBeDefined();

      // Execute recovery action
      await recoveryAction?.action();

      // Should show loading toast and result toast
      expect(mockToastCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "info",
          title: "Recovery in Progress",
          message: "Executing recovery action...",
        })
      );

      expect(mockToastCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error", // Will fail because it's a mock action
          title: "Recovery Failed",
        })
      );
    });
  });

  describe("context creation", () => {
    it("should create web GUI context with browser information", () => {
      const context = errorHandler.createWebGUIContext(
        "TestComponent",
        "testOperation",
        { customData: "test" }
      );

      expect(context.component).toBe("TestComponent");
      expect(context.operation).toBe("testOperation");
      expect(context.additionalData?.userAgent).toBe(
        "Mozilla/5.0 (Test Browser)"
      );
      expect(context.additionalData?.url).toBe("http://localhost:3000/test");
      expect(context.additionalData?.customData).toBe("test");
      expect(context.additionalData?.timestamp).toBeDefined();
    });
  });

  describe("specialized error handlers", () => {
    it("should handle API errors", async () => {
      const error = SnippetLibraryError.network("API request failed");

      await errorHandler.handleAPIError("/api/snippets", "GET", error);

      expect(mockToastCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          title: "Network Error",
          message: "API request failed",
        })
      );
    });

    it("should handle component errors", async () => {
      const error = SnippetLibraryError.validation("Component error");

      await errorHandler.handleComponentError("SnippetGrid", "render", error);

      expect(mockToastCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          title: "Validation Error",
          message: "Component error",
        })
      );
    });
  });

  describe("error summary", () => {
    it("should provide error summary", () => {
      const summary = errorHandler.getErrorSummary();

      expect(summary).toHaveProperty("totalErrors");
      expect(summary).toHaveProperty("recentErrors");
      expect(summary).toHaveProperty("criticalErrors");
      expect(summary).toHaveProperty("errorsByType");
      expect(typeof summary.totalErrors).toBe("number");
      expect(typeof summary.recentErrors).toBe("number");
      expect(typeof summary.criticalErrors).toBe("number");
      expect(typeof summary.errorsByType).toBe("object");
    });
  });

  describe("error type to title mapping", () => {
    const testCases = [
      { type: ErrorType.NETWORK, expected: "Network Error" },
      { type: ErrorType.STORAGE_ACCESS, expected: "Storage Error" },
      { type: ErrorType.VALIDATION, expected: "Validation Error" },
      { type: ErrorType.SYNC_CONFLICT, expected: "Sync Conflict" },
      { type: ErrorType.IMPORT_EXPORT, expected: "Import/Export Error" },
      { type: ErrorType.SEARCH, expected: "Search Error" },
      {
        type: ErrorType.SNIPPET_OPERATION,
        expected: "Snippet Operation Error",
      },
      { type: ErrorType.CONFIGURATION, expected: "Configuration Error" },
    ];

    testCases.forEach(({ type, expected }) => {
      it(`should map ${type} to ${expected}`, async () => {
        const error = new SnippetLibraryError("Test error", type);

        await errorHandler.handleError(error);

        expect(mockToastCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expected,
          })
        );
      });
    });
  });
});
