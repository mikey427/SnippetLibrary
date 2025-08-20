import {
  ErrorType,
  ErrorSeverity,
  SnippetError,
  ErrorContext,
} from "./ErrorTypes";

/**
 * Base error class for all snippet library errors
 */
export class SnippetLibraryError extends Error implements SnippetError {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly details?: any;
  public readonly recoverable: boolean;
  public readonly suggestedAction?: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;
  public readonly originalError?: Error;

  constructor(
    message: string,
    type: ErrorType,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options: {
      code?: string;
      details?: any;
      recoverable?: boolean;
      suggestedAction?: string;
      context?: Record<string, any>;
      originalError?: Error;
    } = {}
  ) {
    super(message);
    this.name = "SnippetLibraryError";
    this.type = type;
    this.severity = severity;
    this.code = options.code || `${type.toUpperCase()}_ERROR`;
    this.details = options.details;
    this.recoverable = options.recoverable ?? true;
    this.suggestedAction = options.suggestedAction;
    this.timestamp = new Date();
    this.context = options.context;
    this.originalError = options.originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SnippetLibraryError);
    }
  }

  /**
   * Create a storage access error
   */
  static storageAccess(
    message: string,
    details?: any,
    originalError?: Error
  ): SnippetLibraryError {
    return new SnippetLibraryError(
      message,
      ErrorType.STORAGE_ACCESS,
      ErrorSeverity.HIGH,
      {
        code: "STORAGE_ACCESS_FAILED",
        details,
        recoverable: true,
        suggestedAction: "Check file permissions and storage location",
        originalError,
      }
    );
  }

  /**
   * Create a validation error
   */
  static validation(message: string, details?: any): SnippetLibraryError {
    return new SnippetLibraryError(
      message,
      ErrorType.VALIDATION,
      ErrorSeverity.MEDIUM,
      {
        code: "VALIDATION_FAILED",
        details,
        recoverable: true,
        suggestedAction: "Please check the input data and try again",
      }
    );
  }

  /**
   * Create a sync conflict error
   */
  static syncConflict(message: string, details?: any): SnippetLibraryError {
    return new SnippetLibraryError(
      message,
      ErrorType.SYNC_CONFLICT,
      ErrorSeverity.MEDIUM,
      {
        code: "SYNC_CONFLICT",
        details,
        recoverable: true,
        suggestedAction: "Resolve conflicts and try syncing again",
      }
    );
  }

  /**
   * Create a network error
   */
  static network(
    message: string,
    details?: any,
    originalError?: Error
  ): SnippetLibraryError {
    return new SnippetLibraryError(
      message,
      ErrorType.NETWORK,
      ErrorSeverity.MEDIUM,
      {
        code: "NETWORK_ERROR",
        details,
        recoverable: true,
        suggestedAction: "Check network connection and try again",
        originalError,
      }
    );
  }

  /**
   * Create an import/export error
   */
  static importExport(
    message: string,
    details?: any,
    originalError?: Error
  ): SnippetLibraryError {
    return new SnippetLibraryError(
      message,
      ErrorType.IMPORT_EXPORT,
      ErrorSeverity.MEDIUM,
      {
        code: "IMPORT_EXPORT_FAILED",
        details,
        recoverable: true,
        suggestedAction: "Check file format and try again",
        originalError,
      }
    );
  }

  /**
   * Create a search error
   */
  static search(
    message: string,
    details?: any,
    originalError?: Error
  ): SnippetLibraryError {
    return new SnippetLibraryError(
      message,
      ErrorType.SEARCH,
      ErrorSeverity.LOW,
      {
        code: "SEARCH_FAILED",
        details,
        recoverable: true,
        suggestedAction: "Try a different search query",
        originalError,
      }
    );
  }

  /**
   * Create a snippet operation error
   */
  static snippetOperation(
    message: string,
    details?: any,
    originalError?: Error
  ): SnippetLibraryError {
    return new SnippetLibraryError(
      message,
      ErrorType.SNIPPET_OPERATION,
      ErrorSeverity.MEDIUM,
      {
        code: "SNIPPET_OPERATION_FAILED",
        details,
        recoverable: true,
        suggestedAction: "Try the operation again or check snippet data",
        originalError,
      }
    );
  }

  /**
   * Create a configuration error
   */
  static configuration(
    message: string,
    details?: any,
    originalError?: Error
  ): SnippetLibraryError {
    return new SnippetLibraryError(
      message,
      ErrorType.CONFIGURATION,
      ErrorSeverity.HIGH,
      {
        code: "CONFIGURATION_ERROR",
        details,
        recoverable: true,
        suggestedAction: "Check configuration settings and reset if needed",
        originalError,
      }
    );
  }

  /**
   * Convert to a plain object for serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      code: this.code,
      details: this.details,
      recoverable: this.recoverable,
      suggestedAction: this.suggestedAction,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }
}
