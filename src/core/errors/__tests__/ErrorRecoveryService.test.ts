import { describe, it, expect, beforeEach, vi } from "vitest";
import { ErrorRecoveryService } from "../ErrorRecoveryService";
import { SnippetLibraryError } from "../SnippetLibraryError";
import { ErrorType, ErrorRecoveryAction } from "../ErrorTypes";

describe("ErrorRecoveryService", () => {
  let recoveryService: ErrorRecoveryService;

  beforeEach(() => {
    recoveryService = new ErrorRecoveryService();
  });

  describe("initialization", () => {
    it("should initialize with default recovery strategies", () => {
      const storageError = SnippetLibraryError.storageAccess("Storage error");
      const actions = recoveryService.getRecoveryActions(storageError);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((action) => action.id === "check_permissions")).toBe(
        true
      );
    });
  });

  describe("recovery actions", () => {
    it("should get recovery actions for storage errors", () => {
      const storageError =
        SnippetLibraryError.storageAccess("Cannot access file");
      const actions = recoveryService.getRecoveryActions(storageError);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((action) => action.id === "check_permissions")).toBe(
        true
      );
      expect(actions.some((action) => action.id === "create_directory")).toBe(
        true
      );
      expect(
        actions.some((action) => action.id === "use_fallback_storage")
      ).toBe(true);
    });

    it("should get recovery actions for network errors", () => {
      const networkError = SnippetLibraryError.network("Connection failed");
      const actions = recoveryService.getRecoveryActions(networkError);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((action) => action.id === "retry_connection")).toBe(
        true
      );
      expect(
        actions.some((action) => action.id === "check_server_status")
      ).toBe(true);
    });

    it("should get recovery actions for sync conflicts", () => {
      const syncError = SnippetLibraryError.syncConflict("Sync conflict");
      const actions = recoveryService.getRecoveryActions(syncError);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((action) => action.id === "resolve_conflicts")).toBe(
        true
      );
      expect(actions.some((action) => action.id === "force_sync")).toBe(true);
    });

    it("should get recovery actions for validation errors", () => {
      const validationError = SnippetLibraryError.validation("Invalid data");
      const actions = recoveryService.getRecoveryActions(validationError);

      expect(actions.length).toBeGreaterThan(0);
      expect(
        actions.some((action) => action.id === "fix_validation_errors")
      ).toBe(true);
      expect(actions.some((action) => action.id === "use_default_values")).toBe(
        true
      );
    });

    it("should get recovery actions for import/export errors", () => {
      const importError = SnippetLibraryError.importExport("Import failed");
      const actions = recoveryService.getRecoveryActions(importError);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((action) => action.id === "check_file_format")).toBe(
        true
      );
      expect(
        actions.some((action) => action.id === "try_different_format")
      ).toBe(true);
    });

    it("should return empty array for unknown error types", () => {
      const unknownError = new SnippetLibraryError(
        "Unknown error",
        "unknown_type" as ErrorType
      );
      const actions = recoveryService.getRecoveryActions(unknownError);

      expect(actions).toEqual([]);
    });
  });

  describe("custom recovery strategies", () => {
    it("should add custom recovery strategy", () => {
      const customAction: ErrorRecoveryAction = {
        id: "custom_action",
        label: "Custom Action",
        description: "Custom recovery action",
        action: vi.fn().mockResolvedValue(undefined),
        automatic: true,
      };

      recoveryService.addRecoveryStrategy({
        errorType: ErrorType.SEARCH,
        actions: [customAction],
        autoExecute: true,
        priority: 1,
      });

      const searchError = SnippetLibraryError.search("Search failed");
      const actions = recoveryService.getRecoveryActions(searchError);

      expect(actions.some((action) => action.id === "custom_action")).toBe(
        true
      );
    });

    it("should sort strategies by priority", () => {
      const highPriorityAction: ErrorRecoveryAction = {
        id: "high_priority",
        label: "High Priority",
        description: "High priority action",
        action: vi.fn().mockResolvedValue(undefined),
        automatic: true,
      };

      const lowPriorityAction: ErrorRecoveryAction = {
        id: "low_priority",
        label: "Low Priority",
        description: "Low priority action",
        action: vi.fn().mockResolvedValue(undefined),
        automatic: true,
      };

      // Add low priority first
      recoveryService.addRecoveryStrategy({
        errorType: ErrorType.SEARCH,
        actions: [lowPriorityAction],
        autoExecute: true,
        priority: 2,
      });

      // Add high priority second
      recoveryService.addRecoveryStrategy({
        errorType: ErrorType.SEARCH,
        actions: [highPriorityAction],
        autoExecute: true,
        priority: 1,
      });

      const searchError = SnippetLibraryError.search("Search failed");
      const actions = recoveryService.getRecoveryActions(searchError);

      const highPriorityIndex = actions.findIndex(
        (a) => a.id === "high_priority"
      );
      const lowPriorityIndex = actions.findIndex(
        (a) => a.id === "low_priority"
      );

      expect(highPriorityIndex).toBeLessThan(lowPriorityIndex);
    });
  });

  describe("automatic recovery", () => {
    it("should attempt automatic recovery for network errors", async () => {
      const mockAction = vi.fn().mockResolvedValue(undefined);

      recoveryService.addRecoveryStrategy({
        errorType: ErrorType.NETWORK,
        autoExecute: true,
        priority: 1,
        actions: [
          {
            id: "auto_retry",
            label: "Auto Retry",
            description: "Automatically retry connection",
            action: mockAction,
            automatic: true,
          },
        ],
      });

      const networkError = SnippetLibraryError.network("Connection failed");
      const result = await recoveryService.attemptRecovery(networkError);

      expect(result.success).toBe(true);
      expect(result.actionExecuted).toBe("auto_retry");
      expect(mockAction).toHaveBeenCalled();
    });

    it("should skip manual actions during automatic recovery", async () => {
      const manualAction = vi.fn().mockResolvedValue(undefined);

      recoveryService.addRecoveryStrategy({
        errorType: ErrorType.NETWORK,
        autoExecute: true,
        priority: 1,
        actions: [
          {
            id: "manual_action",
            label: "Manual Action",
            description: "Manual recovery action",
            action: manualAction,
            automatic: false,
          },
        ],
      });

      const networkError = SnippetLibraryError.network("Connection failed");
      const result = await recoveryService.attemptRecovery(networkError);

      expect(result.success).toBe(false);
      expect(manualAction).not.toHaveBeenCalled();
    });

    it("should continue to next action if one fails", async () => {
      const failingAction = vi
        .fn()
        .mockRejectedValue(new Error("Action failed"));
      const successAction = vi.fn().mockResolvedValue(undefined);

      recoveryService.addRecoveryStrategy({
        errorType: ErrorType.NETWORK,
        autoExecute: true,
        priority: 1,
        actions: [
          {
            id: "failing_action",
            label: "Failing Action",
            description: "This action will fail",
            action: failingAction,
            automatic: true,
          },
          {
            id: "success_action",
            label: "Success Action",
            description: "This action will succeed",
            action: successAction,
            automatic: true,
          },
        ],
      });

      const networkError = SnippetLibraryError.network("Connection failed");
      const result = await recoveryService.attemptRecovery(networkError);

      expect(result.success).toBe(true);
      expect(result.actionExecuted).toBe("success_action");
      expect(failingAction).toHaveBeenCalled();
      expect(successAction).toHaveBeenCalled();
    });
  });

  describe("manual recovery execution", () => {
    it("should execute specific recovery action", async () => {
      const mockAction = vi.fn().mockResolvedValue(undefined);

      recoveryService.addRecoveryStrategy({
        errorType: ErrorType.STORAGE_ACCESS,
        autoExecute: false,
        priority: 1,
        actions: [
          {
            id: "manual_fix",
            label: "Manual Fix",
            description: "Manual recovery action",
            action: mockAction,
            automatic: false,
          },
        ],
      });

      const storageError = SnippetLibraryError.storageAccess("Storage error");
      const result = await recoveryService.executeRecoveryAction(
        storageError,
        "manual_fix"
      );

      expect(result.success).toBe(true);
      expect(result.actionExecuted).toBe("manual_fix");
      expect(mockAction).toHaveBeenCalled();
    });

    it("should handle action not found", async () => {
      const storageError = SnippetLibraryError.storageAccess("Storage error");
      const result = await recoveryService.executeRecoveryAction(
        storageError,
        "nonexistent_action"
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("should handle action execution failure", async () => {
      const failingAction = vi
        .fn()
        .mockRejectedValue(new Error("Action failed"));

      recoveryService.addRecoveryStrategy({
        errorType: ErrorType.STORAGE_ACCESS,
        autoExecute: false,
        priority: 1,
        actions: [
          {
            id: "failing_action",
            label: "Failing Action",
            description: "This action will fail",
            action: failingAction,
            automatic: false,
          },
        ],
      });

      const storageError = SnippetLibraryError.storageAccess("Storage error");
      const result = await recoveryService.executeRecoveryAction(
        storageError,
        "failing_action"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SnippetLibraryError);
      expect(failingAction).toHaveBeenCalled();
    });
  });

  describe("error message generation", () => {
    it("should generate user-friendly error message", () => {
      const error = SnippetLibraryError.storageAccess(
        "Cannot access file",
        undefined,
        undefined
      );

      const message = recoveryService.getErrorMessage(error);

      expect(message).toContain("Cannot access file");
      expect(message).toContain("Suggested action");
      expect(message).toContain("Available recovery options");
    });

    it("should include recovery options in message", () => {
      const error = SnippetLibraryError.storageAccess("Storage error");
      const message = recoveryService.getErrorMessage(error);

      expect(message).toContain("Check File Permissions");
      expect(message).toContain("Create Storage Directory");
    });
  });

  describe("recovery capability checks", () => {
    it("should check for automatic recovery capability", () => {
      const networkError = SnippetLibraryError.network("Network error");
      const hasAutoRecovery =
        recoveryService.hasAutomaticRecovery(networkError);

      expect(hasAutoRecovery).toBe(true);
    });

    it("should check for manual recovery capability", () => {
      const storageError = SnippetLibraryError.storageAccess("Storage error");
      const hasManualRecovery = recoveryService.hasManualRecovery(storageError);

      expect(hasManualRecovery).toBe(true);
    });

    it("should return false for unknown error types", () => {
      const unknownError = new SnippetLibraryError(
        "Unknown error",
        "unknown_type" as ErrorType
      );

      expect(recoveryService.hasAutomaticRecovery(unknownError)).toBe(false);
      expect(recoveryService.hasManualRecovery(unknownError)).toBe(false);
    });
  });
});
