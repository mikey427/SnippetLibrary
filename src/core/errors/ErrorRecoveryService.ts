import { SnippetLibraryError } from "./SnippetLibraryError";
import { ErrorRecoveryAction, ErrorType, ErrorSeverity } from "./ErrorTypes";
import { ErrorLogger } from "./ErrorLogger";
import { RetryManager } from "./RetryManager";

export interface RecoveryStrategy {
  readonly errorType: ErrorType;
  readonly actions: ErrorRecoveryAction[];
  readonly autoExecute: boolean;
  readonly priority: number;
}

export interface RecoveryResult {
  readonly success: boolean;
  readonly actionExecuted?: string;
  readonly error?: SnippetLibraryError;
  readonly message: string;
}

/**
 * Service for handling error recovery and providing recovery suggestions
 */
export class ErrorRecoveryService {
  private logger: ErrorLogger;
  private retryManager: RetryManager;
  private recoveryStrategies: Map<ErrorType, RecoveryStrategy[]> = new Map();

  constructor() {
    this.logger = ErrorLogger.getInstance();
    this.retryManager = new RetryManager();
    this.initializeRecoveryStrategies();
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    // Storage access recovery strategies
    this.addRecoveryStrategy({
      errorType: ErrorType.STORAGE_ACCESS,
      autoExecute: false,
      priority: 1,
      actions: [
        {
          id: "check_permissions",
          label: "Check File Permissions",
          description:
            "Verify that the application has read/write access to the storage location",
          action: async () => {
            // This would be implemented by the storage service
            throw new Error("Manual action required");
          },
          automatic: false,
        },
        {
          id: "create_directory",
          label: "Create Storage Directory",
          description: "Create the storage directory if it doesn't exist",
          action: async () => {
            // This would be implemented by the storage service
            throw new Error("Manual action required");
          },
          automatic: true,
        },
        {
          id: "use_fallback_storage",
          label: "Use Fallback Storage",
          description: "Switch to an alternative storage location",
          action: async () => {
            // This would be implemented by the storage service
            throw new Error("Manual action required");
          },
          automatic: true,
        },
      ],
    });

    // Network error recovery strategies
    this.addRecoveryStrategy({
      errorType: ErrorType.NETWORK,
      autoExecute: true,
      priority: 1,
      actions: [
        {
          id: "retry_connection",
          label: "Retry Connection",
          description: "Attempt to reconnect to the server",
          action: async () => {
            // This would be implemented by the network service
            throw new Error("Manual action required");
          },
          automatic: true,
        },
        {
          id: "check_server_status",
          label: "Check Server Status",
          description: "Verify that the web GUI server is running",
          action: async () => {
            // This would be implemented by the web GUI service
            throw new Error("Manual action required");
          },
          automatic: false,
        },
      ],
    });

    // Sync conflict recovery strategies
    this.addRecoveryStrategy({
      errorType: ErrorType.SYNC_CONFLICT,
      autoExecute: false,
      priority: 1,
      actions: [
        {
          id: "resolve_conflicts",
          label: "Resolve Conflicts",
          description: "Manually resolve synchronization conflicts",
          action: async () => {
            // This would be implemented by the sync service
            throw new Error("Manual action required");
          },
          automatic: false,
        },
        {
          id: "force_sync",
          label: "Force Synchronization",
          description:
            "Force synchronization, potentially overwriting conflicting changes",
          action: async () => {
            // This would be implemented by the sync service
            throw new Error("Manual action required");
          },
          automatic: false,
        },
      ],
    });

    // Validation error recovery strategies
    this.addRecoveryStrategy({
      errorType: ErrorType.VALIDATION,
      autoExecute: false,
      priority: 1,
      actions: [
        {
          id: "fix_validation_errors",
          label: "Fix Validation Errors",
          description: "Correct the validation errors in the input data",
          action: async () => {
            throw new Error("Manual action required");
          },
          automatic: false,
        },
        {
          id: "use_default_values",
          label: "Use Default Values",
          description: "Replace invalid values with sensible defaults",
          action: async () => {
            // This would be implemented by the validation service
            throw new Error("Manual action required");
          },
          automatic: true,
        },
      ],
    });

    // Import/Export error recovery strategies
    this.addRecoveryStrategy({
      errorType: ErrorType.IMPORT_EXPORT,
      autoExecute: false,
      priority: 1,
      actions: [
        {
          id: "check_file_format",
          label: "Check File Format",
          description: "Verify that the file is in the correct format",
          action: async () => {
            throw new Error("Manual action required");
          },
          automatic: false,
        },
        {
          id: "try_different_format",
          label: "Try Different Format",
          description: "Attempt to import using a different file format",
          action: async () => {
            // This would be implemented by the import service
            throw new Error("Manual action required");
          },
          automatic: true,
        },
      ],
    });
  }

  /**
   * Add a recovery strategy for an error type
   */
  public addRecoveryStrategy(strategy: RecoveryStrategy): void {
    const existing = this.recoveryStrategies.get(strategy.errorType) || [];
    existing.push(strategy);
    existing.sort((a, b) => a.priority - b.priority);
    this.recoveryStrategies.set(strategy.errorType, existing);
  }

  /**
   * Get recovery actions for an error
   */
  public getRecoveryActions(error: SnippetLibraryError): ErrorRecoveryAction[] {
    const strategies = this.recoveryStrategies.get(error.type) || [];
    return strategies.flatMap((strategy) => strategy.actions);
  }

  /**
   * Attempt automatic recovery for an error
   */
  public async attemptRecovery(
    error: SnippetLibraryError
  ): Promise<RecoveryResult> {
    this.logger.logInfo(`Attempting recovery for error: ${error.message}`, {
      component: "ErrorRecoveryService",
      operation: "attemptRecovery",
    });

    const strategies = this.recoveryStrategies.get(error.type) || [];

    for (const strategy of strategies) {
      if (!strategy.autoExecute) {
        continue;
      }

      for (const action of strategy.actions) {
        if (!action.automatic) {
          continue;
        }

        try {
          this.logger.logDebug(`Executing recovery action: ${action.id}`);

          await action.action();

          this.logger.logInfo(
            `Recovery action ${action.id} completed successfully`
          );

          return {
            success: true,
            actionExecuted: action.id,
            message: `Recovery successful: ${action.description}`,
          };
        } catch (recoveryError) {
          this.logger.logWarning(
            `Recovery action ${action.id} failed: ${recoveryError}`
          );
          continue;
        }
      }
    }

    return {
      success: false,
      message: "No automatic recovery actions available",
    };
  }

  /**
   * Execute a specific recovery action
   */
  public async executeRecoveryAction(
    error: SnippetLibraryError,
    actionId: string
  ): Promise<RecoveryResult> {
    const actions = this.getRecoveryActions(error);
    const action = actions.find((a) => a.id === actionId);

    if (!action) {
      return {
        success: false,
        message: `Recovery action ${actionId} not found`,
      };
    }

    try {
      this.logger.logInfo(`Executing recovery action: ${action.id}`);

      await action.action();

      this.logger.logInfo(
        `Recovery action ${action.id} completed successfully`
      );

      return {
        success: true,
        actionExecuted: action.id,
        message: `Recovery successful: ${action.description}`,
      };
    } catch (recoveryError) {
      const normalizedError =
        recoveryError instanceof SnippetLibraryError
          ? recoveryError
          : SnippetLibraryError.snippetOperation(
              `Recovery action failed: ${recoveryError}`,
              { originalError: recoveryError }
            );

      this.logger.logError(normalizedError);

      return {
        success: false,
        actionExecuted: action.id,
        error: normalizedError,
        message: `Recovery failed: ${normalizedError.message}`,
      };
    }
  }

  /**
   * Get user-friendly error message with recovery suggestions
   */
  public getErrorMessage(error: SnippetLibraryError): string {
    const actions = this.getRecoveryActions(error);
    let message = error.message;

    if (error.suggestedAction) {
      message += `\n\nSuggested action: ${error.suggestedAction}`;
    }

    if (actions.length > 0) {
      const manualActions = actions.filter((a) => !a.automatic);
      if (manualActions.length > 0) {
        message += "\n\nAvailable recovery options:";
        manualActions.forEach((action) => {
          message += `\n• ${action.label}: ${action.description}`;
        });
      }
    }

    return message;
  }

  /**
   * Check if an error has automatic recovery options
   */
  public hasAutomaticRecovery(error: SnippetLibraryError): boolean {
    const strategies = this.recoveryStrategies.get(error.type) || [];
    return strategies.some(
      (strategy) =>
        strategy.autoExecute &&
        strategy.actions.some((action) => action.automatic)
    );
  }

  /**
   * Check if an error has manual recovery options
   */
  public hasManualRecovery(error: SnippetLibraryError): boolean {
    const actions = this.getRecoveryActions(error);
    return actions.some((action) => !action.automatic);
  }
}
