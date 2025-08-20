/**
 * Error handling and recovery system for the snippet library
 */

export * from "./ErrorTypes";
export * from "./SnippetLibraryError";
export * from "./ErrorLogger";
export * from "./RetryManager";
export * from "./ErrorRecoveryService";
export * from "./ErrorHandler";

// Re-export commonly used types and classes
export {
  ErrorType,
  ErrorSeverity,
  SnippetError,
  ErrorRecoveryAction,
  ErrorHandlingOptions,
  ErrorContext,
} from "./ErrorTypes";

export { SnippetLibraryError } from "./SnippetLibraryError";

export { ErrorLogger, LogLevel } from "./ErrorLogger";

export { RetryManager, RetryConfig, RetryResult } from "./RetryManager";

export { ErrorRecoveryService, RecoveryResult } from "./ErrorRecoveryService";

export { ErrorHandler, ErrorHandlingResult } from "./ErrorHandler";
