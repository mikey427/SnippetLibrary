import { describe, it, expect, beforeEach, vi } from "vitest";
import * as vscode from "vscode";
import { VSCodeErrorHandler } from "../VSCodeErrorHandler";
import {
  SnippetLibraryError,
  ErrorType,
  ErrorSeverity,
} from "../../../core/errors";

// Mock VS Code API
vi.mock("vscode", () => ({
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showTextDocument: vi.fn(),
    withProgress: vi.fn(),
    activeTextEditor: {
      document: {
        uri: { toString: () => "file:///test.ts" },
        languageId: "typescript",
      },
    },
  },
  workspace: {
    openTextDocument: vi.fn(),
    workspaceFolders: [
      {
        uri: { toString: () => "file:///workspace" },
      },
    ],
  },
  ProgressLocation: {
    Notification: 15,
  },
}));

describe("VSCodeErrorHandler", () => {
  let errorHandler: VSCodeErrorHandler;

  beforeEach(() => {
    errorHandler = new VSCodeErrorHandler();
    vi.clearAllMocks();
  });

  describe("error notification display", () => {
    it("should show information message for low severity errors", async () => {
      const error = new SnippetLibraryError(
        "Low severity error",
        ErrorType.SEARCH,
        ErrorSeverity.LOW
      );

      await errorHandler.handleError(error);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining("Low severity error")
      );
    });

    it("should show warning message for medium severity errors", async () => {
      const error = SnippetLibraryError.validation("Validation error");

      await errorHandler.handleError(error);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("Validation error")
      );
    });

    it("should show error message for high severity errors", async () => {
      const error = SnippetLibraryError.storageAccess("Storage error");

      await errorHandler.handleError(error);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("Storage error"),
        expect.any(String), // Recovery action
        expect.any(String), // Recovery action
        expect.any(String), // Recovery action
        "Show Details",
        "Dismiss"
      );
    });

    it("should show error message for critical severity errors", async () => {
      const error = new SnippetLibraryError(
        "Critical error",
        ErrorType.CONFIGURATION,
        ErrorSeverity.CRITICAL
      );

      await errorHandler.handleError(error);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("Critical error"),
        expect.any(String),
        "Show Details",
        "Dismiss"
      );
    });

    it("should not show notification when disabled", async () => {
      const error = SnippetLibraryError.validation("Test error");

      await errorHandler.handleError(error, undefined, false);

      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
  });

  describe("operation execution with error handling", () => {
    it("should execute successful operation", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await errorHandler.executeWithVSCodeErrorHandling(
        operation,
        "test-operation"
      );

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should handle operation failure", async () => {
      const error = SnippetLibraryError.validation("Operation failed");
      const operation = vi.fn().mockRejectedValue(error);

      const result = await errorHandler.executeWithVSCodeErrorHandling(
        operation,
        "test-operation"
      );

      expect(result).toBeUndefined();
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it("should return undefined on error without notification", async () => {
      const error = SnippetLibraryError.validation("Operation failed");
      const operation = vi.fn().mockRejectedValue(error);

      const result = await errorHandler.executeWithVSCodeErrorHandling(
        operation,
        "test-operation",
        undefined,
        false
      );

      expect(result).toBeUndefined();
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });
  });

  describe("error details display", () => {
    it("should show error details when requested", async () => {
      const mockDocument = { uri: "test-uri" };
      (vscode.workspace.openTextDocument as any).mockResolvedValue(
        mockDocument
      );
      (vscode.window.showErrorMessage as any).mockResolvedValue("Show Details");

      const error = SnippetLibraryError.storageAccess("Storage error");

      await errorHandler.handleError(error);

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith({
        content: expect.stringContaining("# Error Details"),
        language: "markdown",
      });
      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDocument);
    });

    it("should format error details correctly", async () => {
      const mockDocument = { uri: "test-uri" };
      (vscode.workspace.openTextDocument as any).mockResolvedValue(
        mockDocument
      );
      (vscode.window.showErrorMessage as any).mockResolvedValue("Show Details");

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

      const openTextDocumentCall = (vscode.workspace.openTextDocument as any)
        .mock.calls[0][0];
      const content = openTextDocumentCall.content;

      expect(content).toContain("# Error Details");
      expect(content).toContain("**Type**: storage_access");
      expect(content).toContain("**Severity**: high");
      expect(content).toContain("**Code**: TEST_CODE");
      expect(content).toContain("**Message**: Test error");
      expect(content).toContain('"path": "/test"');
      expect(content).toContain('"userId": "123"');
    });
  });

  describe("recovery action execution", () => {
    it("should execute recovery action with progress indication", async () => {
      const mockProgressCallback = vi.fn();
      (vscode.window.withProgress as any).mockImplementation(
        (options, callback) => {
          return callback(mockProgressCallback);
        }
      );
      (vscode.window.showErrorMessage as any).mockResolvedValue(
        "Check File Permissions"
      );

      const error = SnippetLibraryError.storageAccess("Storage error");

      await errorHandler.handleError(error);

      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Executing recovery action...",
          cancellable: false,
        },
        expect.any(Function)
      );
    });
  });

  describe("context creation", () => {
    it("should create VS Code context with document information", () => {
      const mockDocument = {
        uri: { toString: () => "file:///test.ts" },
        languageId: "typescript",
      } as vscode.TextDocument;

      const context = errorHandler.createVSCodeContext(
        "TestComponent",
        "testOperation",
        mockDocument,
        { customData: "test" }
      );

      expect(context.component).toBe("TestComponent");
      expect(context.operation).toBe("testOperation");
      expect(context.additionalData?.documentUri).toBe("file:///test.ts");
      expect(context.additionalData?.documentLanguage).toBe("typescript");
      expect(context.additionalData?.workspaceFolder).toBe("file:///workspace");
      expect(context.additionalData?.customData).toBe("test");
    });

    it("should create context without document", () => {
      const context = errorHandler.createVSCodeContext(
        "TestComponent",
        "testOperation"
      );

      expect(context.component).toBe("TestComponent");
      expect(context.operation).toBe("testOperation");
      expect(context.additionalData?.documentUri).toBeUndefined();
    });
  });

  describe("specialized error handlers", () => {
    it("should handle command errors", async () => {
      const error = new Error("Command failed");

      await errorHandler.handleCommandError("test.command", error);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("Command failed")
      );
    });

    it("should handle file operation errors", async () => {
      const error = SnippetLibraryError.storageAccess("File not found");

      await errorHandler.handleFileOperationError(
        "read",
        "/path/to/file.json",
        error
      );

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("File not found")
      );
    });

    it("should handle snippet operation errors", async () => {
      const error = SnippetLibraryError.validation("Invalid snippet");

      await errorHandler.handleSnippetOperationError(
        "create",
        "snippet-123",
        error
      );

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("Invalid snippet")
      );
    });
  });

  describe("error summary", () => {
    it("should provide error summary", () => {
      const summary = errorHandler.getErrorSummary();

      expect(summary).toHaveProperty("totalErrors");
      expect(summary).toHaveProperty("recentErrors");
      expect(summary).toHaveProperty("criticalErrors");
      expect(typeof summary.totalErrors).toBe("number");
      expect(typeof summary.recentErrors).toBe("number");
      expect(typeof summary.criticalErrors).toBe("number");
    });
  });
});
