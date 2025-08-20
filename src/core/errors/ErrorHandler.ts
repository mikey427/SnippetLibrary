import { SnippetLibraryError } from "./SnippetLibraryError";
import { ErrorLogger } from "./ErrorLogger";
import { ErrorRecoveryService, RecoveryResult } from "./ErrorRecoveryService";
import { RetryManager, RetryResult } from "./RetryManager";
import {
  ErrorHandlingOptions,
  ErrorContext,
  ErrorSeverity,
} from "./ErrorTypes";

export interface ErrorHandlingResult<T = any> {
  readonly success: boolean;
  readonly result?: T;
  readonly error?: SnippetLibraryError;
  readonly recoveryAttempted: boolean;
  readonly recoveryResult?: RecoveryResult;
  readonly retryResult?: RetryResult<T>;
}

/**
 * Central error handling service that coordinates logging, recovery, and retry mechanisms
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private logger: ErrorLogger;
  private recoveryService: ErrorRecoveryService;
  private retryManager: RetryManager;

  private constructor() {
    this.logger = ErrorLogger.getInstance();
    this.recoveryService = new ErrorRecoveryService();
    this.retryManager = new RetryManager();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle an error with full error handling pipeline
   */
  public async handleError<T = any>(
    error: any,
    context?: ErrorContext,
    options: ErrorHandlingOptions = {}
  ): Promise<ErrorHandlingResult<T>> {
    const snippetError = this.normalizeError(error);

    // Log the error
    if (options.logErrors !== false) {
      this.logger.logError(snippetError, context);
    }

    let recoveryAttempted = false;
    let recoveryResult: RecoveryResult | undefined;

    // Attempt automatic recovery if enabled
    if (
      options.autoRecover !== false &&
      this.recoveryService.hasAutomaticRecovery(snippetError)
    ) {
      recoveryAttempted = true;
      recoveryResult = await this.recoveryService.attemptRecovery(snippetError);

      if (recoveryResult.success) {
        this.logger.logInfo(
          `Automatic recovery successful for error: ${snippetError.message}`,
          context
        );

        return {
          success: true,
          recoveryAttempted,
          recoveryResult,
        };
      }
    }

    return {
      success: false,
      error: snippetError,
      recoveryAttempted,
      recoveryResult,
    };
  }

  /**
   * Execute an operation with comprehensive error handling
   */
  public async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: ErrorContext,
    options: ErrorHandlingOptions = {}
  ): Promise<ErrorHandlingResult<T>> {
    try {
      // Execute with retry if configured
      if (options.maxRetries && options.maxRetries > 0) {
        const retryResult = await this.retryManager.executeWithRetry(
          operation,
          operationName,
          {
            maxRetries: options.maxRetries,
            initialDelay: options.retryDelay || 1000,
            exponentialBackoff: options.exponentialBackoff !== false,
          }
        );

        if (retryResult.success) {
          return {
            success: true,
            result: retryResult.result,
            recoveryAttempted: false,
            retryResult,
          };
        } else {
          // Handle the final error after retries failed
          const errorResult = await this.handleError(
            retryResult.error,
            context,
            options
          );

          return {
            ...errorResult,
            retryResult,
          };
        }
      } else {
        // Execute without retry
        const result = await operation();
        return {
          success: true,
          result,
          recoveryAttempted: false,
        };
      }
    } catch (error) {
      return await this.handleError<T>(error, context, options);
    }
  }

  /**
   * Handle errors in a synchronous context
   */
  public handleSyncError(
    error: any,
    context?: ErrorContext,
    options: ErrorHandlingOptions = {}
  ): ErrorHandlingResult {
    const snippetError = this.normalizeError(error);

    // Log the error
    if (options.logErrors !== false) {
      this.logger.logError(snippetError, context);
    }

    return {
      success: false,
      error: snippetError,
      recoveryAttempted: false,
    };
  }

  /**
   * Get user-friendly error message
   */
  public getUserFriendlyMessage(error: SnippetLibraryError): string {
    return this.recoveryService.getErrorMessage(error);
  }

  /**
   * Get available recovery actions for an error
   */
  public getRecoveryActions(error: SnippetLibraryError) {
    return this.recoveryService.getRecoveryActions(error);
  }

  /**
   * Execute a specific recovery action
   */
  public async executeRecoveryAction(
    error: SnippetLibraryError,
    actionId: string
  ): Promise<RecoveryResult> {
    return await this.recoveryService.executeRecoveryAction(error, actionId);
  }

  /**
   * Create error context for operations
   */
  public createContext(
    component: string,
    operation: string,
    additionalData?: Record<string, any>
  ): ErrorContext {
    return {
      component,
      operation,
      additionalData,
    };
  }

  /**
   * Normalize any error to SnippetLibraryError
   */
  private normalizeError(error: any): SnippetLibraryError {
    if (error instanceof SnippetLibraryError) {
      return error;
    }

    if (error instanceof Error) {
      return SnippetLibraryError.snippetOperation(
        error.message,
        { originalError: error },
        error
      );
    }

    return SnippetLibraryError.snippetOperation(
      typeof error === "string" ? error : "Unknown error occurred",
      { originalError: error }
    );
  }

  /**
   * Check if an error is critical and requires immediate attention
   */
  public isCriticalError(error: SnippetLibraryError): boolean {
    return error.severity === ErrorSeverity.CRITICAL;
  }

  /**
   * Check if an error is recoverable
   */
  public isRecoverableError(error: SnippetLibraryError): boolean {
    return error.recoverable;
  }

  /**
   * Get error statistics
   */
  public getErrorStats() {
    const errorLogs = this.logger.getErrorLogs();
    const stats = {
      total: errorLogs.length,
      bySeverity: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      recent: errorLogs.slice(-10),
    };

    errorLogs.forEach((log) => {
      if (log.error) {
        const severity = log.error.severity;
        const type = log.error.type;

        stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      }
    });

    return stats;
  }
}
