/**
 * Core error types and interfaces for the snippet library system
 */

export enum ErrorType {
  STORAGE_ACCESS = "storage_access",
  VALIDATION = "validation",
  SYNC_CONFLICT = "sync_conflict",
  NETWORK = "network",
  IMPORT_EXPORT = "import_export",
  SEARCH = "search",
  SNIPPET_OPERATION = "snippet_operation",
  CONFIGURATION = "configuration",
  UNKNOWN = "unknown",
}

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface SnippetError extends Error {
  readonly type: ErrorType;
  readonly severity: ErrorSeverity;
  readonly code: string;
  readonly details?: any;
  readonly recoverable: boolean;
  readonly suggestedAction?: string;
  readonly timestamp: Date;
  readonly context?: Record<string, any>;
  readonly originalError?: Error;
}

export interface ErrorRecoveryAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly action: () => Promise<void>;
  readonly automatic: boolean;
}

export interface ErrorHandlingOptions {
  readonly maxRetries?: number;
  readonly retryDelay?: number;
  readonly exponentialBackoff?: boolean;
  readonly logErrors?: boolean;
  readonly notifyUser?: boolean;
  readonly autoRecover?: boolean;
}

export interface ErrorContext {
  readonly component: string;
  readonly operation: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly additionalData?: Record<string, any>;
}
