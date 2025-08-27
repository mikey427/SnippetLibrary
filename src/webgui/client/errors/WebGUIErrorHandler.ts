import {
  ErrorHandler,
  SnippetLibraryError,
  ErrorSeverity,
  ErrorType,
  ErrorContext,
} from "../../../core/errors";

export interface ToastNotification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
  duration?: number;
  persistent?: boolean;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: SnippetLibraryError;
  errorId?: string;
}

/**
 * Web GUI specific error handler that integrates with React toast notifications
 */
export class WebGUIErrorHandler {
  private coreHandler: ErrorHandler;
  private toastCallback?: (notification: ToastNotification) => void;
  private errorBoundaryCallback?: (state: ErrorBoundaryState) => void;

  constructor() {
    this.coreHandler = ErrorHandler.getInstance();
  }

  /**
   * Set callback for showing toast notifications
   */
  public setToastCallback(
    callback: (notification: ToastNotification) => void
  ): void {
    this.toastCallback = callback;
  }

  /**
   * Set callback for error boundary updates
   */
  public setErrorBoundaryCallback(
    callback: (state: ErrorBoundaryState) => void
  ): void {
    this.errorBoundaryCallback = callback;
  }

  /**
   * Handle error with web GUI notifications
   */
  public async handleError(
    error: any,
    context?: ErrorContext,
    showNotification: boolean = true
  ): Promise<void> {
    const result = await this.coreHandler.handleError(error, context);

    if (showNotification && result.error) {
      this.showErrorNotification(result.error);
    }

    // Update error boundary for critical errors
    if (result.error && this.coreHandler.isCriticalError(result.error)) {
      this.updateErrorBoundary(result.error);
    }
  }

  /**
   * Execute operation with web GUI error handling
   */
  public async executeWithWebGUIErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: ErrorContext,
    showNotification: boolean = true
  ): Promise<T | undefined> {
    try {
      const result = await this.coreHandler.executeWithErrorHandling(
        operation,
        operationName,
        context,
        {
          maxRetries: 2,
          retryDelay: 1000,
          autoRecover: true,
        }
      );

      if (result.success) {
        return result.result;
      } else if (result.error && showNotification) {
        this.showErrorNotification(result.error);
      }

      return undefined;
    } catch (error) {
      await this.handleError(error, context, showNotification);
      return undefined;
    }
  }

  /**
   * Show appropriate toast notification based on error severity
   */
  private showErrorNotification(error: SnippetLibraryError): void {
    if (!this.toastCallback) {
      console.error(
        "Toast callback not set, falling back to console error:",
        error
      );
      return;
    }

    const actions = this.coreHandler.getRecoveryActions(error);
    const recoveryActions = actions
      .filter((action) => !action.automatic)
      .slice(0, 2) // Limit to 2 actions for toast
      .map((action) => ({
        label: action.label,
        action: () => this.executeRecoveryAction(error, action.id),
      }));

    // Add "Show Details" action for high/critical errors
    if (
      error.severity === ErrorSeverity.HIGH ||
      error.severity === ErrorSeverity.CRITICAL
    ) {
      recoveryActions.push({
        label: "Show Details",
        action: async () => this.showErrorDetails(error),
      });
    }

    const notification: ToastNotification = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.severityToToastType(error.severity),
      title: this.getErrorTitle(error),
      message: error.message,
      actions: recoveryActions.length > 0 ? recoveryActions : undefined,
      duration: this.getNotificationDuration(error.severity),
      persistent: error.severity === ErrorSeverity.CRITICAL,
    };

    this.toastCallback(notification);
  }

  /**
   * Convert error severity to toast type
   */
  private severityToToastType(
    severity: ErrorSeverity
  ): ToastNotification["type"] {
    switch (severity) {
      case ErrorSeverity.LOW:
        return "info";
      case ErrorSeverity.MEDIUM:
        return "warning";
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return "error";
      default:
        return "error";
    }
  }

  /**
   * Get error title based on type
   */
  private getErrorTitle(error: SnippetLibraryError): string {
    switch (error.type) {
      case ErrorType.NETWORK:
        return "Network Error";
      case ErrorType.STORAGE_ACCESS:
        return "Storage Error";
      case ErrorType.VALIDATION:
        return "Validation Error";
      case ErrorType.SYNC_CONFLICT:
        return "Sync Conflict";
      case ErrorType.IMPORT_EXPORT:
        return "Import/Export Error";
      case ErrorType.SEARCH:
        return "Search Error";
      case ErrorType.SNIPPET_OPERATION:
        return "Snippet Operation Error";
      case ErrorType.CONFIGURATION:
        return "Configuration Error";
      default:
        return "Error";
    }
  }

  /**
   * Get notification duration based on severity
   */
  private getNotificationDuration(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 3000; // 3 seconds
      case ErrorSeverity.MEDIUM:
        return 5000; // 5 seconds
      case ErrorSeverity.HIGH:
        return 8000; // 8 seconds
      case ErrorSeverity.CRITICAL:
        return 0; // Persistent
      default:
        return 5000;
    }
  }

  /**
   * Show detailed error information in a modal or dedicated page
   */
  private showErrorDetails(error: SnippetLibraryError): void {
    // This would typically open a modal or navigate to an error details page
    // For now, we'll show a detailed toast
    if (this.toastCallback) {
      const details = this.formatErrorDetails(error);

      this.toastCallback({
        id: `error-details-${Date.now()}`,
        type: "error",
        title: "Error Details",
        message: details,
        persistent: true,
        actions: [
          {
            label: "Copy to Clipboard",
            action: () => this.copyErrorToClipboard(error),
          },
          {
            label: "Download Report",
            action: () => this.downloadErrorReport(error),
          },
        ],
      });
    }
  }

  /**
   * Format error details for display
   */
  private formatErrorDetails(error: SnippetLibraryError): string {
    return `
Type: ${error.type}
Severity: ${error.severity}
Code: ${error.code}
Recoverable: ${error.recoverable ? "Yes" : "No"}
Time: ${error.timestamp.toLocaleString()}

${error.suggestedAction ? `Suggested Action: ${error.suggestedAction}` : ""}

${error.details ? `Details: ${JSON.stringify(error.details, null, 2)}` : ""}
    `.trim();
  }

  /**
   * Copy error information to clipboard
   */
  private async copyErrorToClipboard(
    error: SnippetLibraryError
  ): Promise<void> {
    try {
      const errorReport = this.generateErrorReport(error);
      await navigator.clipboard.writeText(errorReport);

      if (this.toastCallback) {
        this.toastCallback({
          id: `copy-success-${Date.now()}`,
          type: "success",
          title: "Copied",
          message: "Error details copied to clipboard",
          duration: 2000,
        });
      }
    } catch (clipboardError) {
      console.error("Failed to copy to clipboard:", clipboardError);
    }
  }

  /**
   * Download error report as a file
   */
  private downloadErrorReport(error: SnippetLibraryError): void {
    try {
      const errorReport = this.generateErrorReport(error);
      const blob = new Blob([errorReport], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `error-report-${error.timestamp
        .toISOString()
        .replace(/[:.]/g, "-")}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error("Failed to download error report:", downloadError);
    }
  }

  /**
   * Generate comprehensive error report
   */
  private generateErrorReport(error: SnippetLibraryError): string {
    const stats = this.coreHandler.getErrorStats();

    return `# Snippet Library Error Report

## Error Information
- Type: ${error.type}
- Severity: ${error.severity}
- Code: ${error.code}
- Message: ${error.message}
- Recoverable: ${error.recoverable ? "Yes" : "No"}
- Timestamp: ${error.timestamp.toISOString()}

## Suggested Action
${error.suggestedAction || "No specific action suggested"}

## Context
${
  error.context
    ? JSON.stringify(error.context, null, 2)
    : "No context available"
}

## Details
${
  error.details
    ? JSON.stringify(error.details, null, 2)
    : "No additional details"
}

## Stack Trace
${error.stack || "No stack trace available"}

## Original Error
${
  error.originalError
    ? `
Message: ${error.originalError.message}
Stack: ${error.originalError.stack || "No stack trace"}
`
    : "No original error"
}

## Browser Information
- User Agent: ${navigator.userAgent}
- Platform: ${navigator.platform}
- Language: ${navigator.language}
- Online: ${navigator.onLine}

## Error Statistics
- Total Errors: ${stats.total}
- By Severity: ${JSON.stringify(stats.bySeverity, null, 2)}
- By Type: ${JSON.stringify(stats.byType, null, 2)}

## Recent Errors
${stats.recent
  .map(
    (log) =>
      `- ${log.timestamp.toISOString()}: ${log.error?.type || "Unknown"} - ${
        log.message
      }`
  )
  .join("\n")}

---
Generated at: ${new Date().toISOString()}
`;
  }

  /**
   * Execute a recovery action with user feedback
   */
  private async executeRecoveryAction(
    error: SnippetLibraryError,
    actionId: string
  ): Promise<void> {
    try {
      // Show loading toast
      if (this.toastCallback) {
        this.toastCallback({
          id: `recovery-loading-${Date.now()}`,
          type: "info",
          title: "Recovery in Progress",
          message: "Executing recovery action...",
          duration: 0, // Will be replaced by result
        });
      }

      const result = await this.coreHandler.executeRecoveryAction(
        error,
        actionId
      );

      if (this.toastCallback) {
        this.toastCallback({
          id: `recovery-result-${Date.now()}`,
          type: result.success ? "success" : "error",
          title: result.success ? "Recovery Successful" : "Recovery Failed",
          message: result.message,
          duration: result.success ? 3000 : 5000,
        });
      }
    } catch (recoveryError) {
      if (this.toastCallback) {
        this.toastCallback({
          id: `recovery-error-${Date.now()}`,
          type: "error",
          title: "Recovery Failed",
          message: `Failed to execute recovery action: ${recoveryError}`,
          duration: 5000,
        });
      }
    }
  }

  /**
   * Update error boundary state
   */
  private updateErrorBoundary(error: SnippetLibraryError): void {
    if (this.errorBoundaryCallback) {
      this.errorBoundaryCallback({
        hasError: true,
        error,
        errorId: `error-${Date.now()}`,
      });
    }
  }

  /**
   * Clear error boundary state
   */
  public clearErrorBoundary(): void {
    if (this.errorBoundaryCallback) {
      this.errorBoundaryCallback({
        hasError: false,
      });
    }
  }

  /**
   * Create error context for web GUI operations
   */
  public createWebGUIContext(
    component: string,
    operation: string,
    additionalData?: Record<string, any>
  ): ErrorContext {
    return this.coreHandler.createContext(component, operation, {
      ...additionalData,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle API errors
   */
  public async handleAPIError(
    endpoint: string,
    method: string,
    error: any,
    showNotification: boolean = true
  ): Promise<void> {
    const context = this.createWebGUIContext(
      "APIClient",
      `${method} ${endpoint}`,
      { endpoint, method }
    );

    await this.handleError(error, context, showNotification);
  }

  /**
   * Handle component errors
   */
  public async handleComponentError(
    componentName: string,
    operation: string,
    error: any,
    showNotification: boolean = true
  ): Promise<void> {
    const context = this.createWebGUIContext(componentName, operation);

    await this.handleError(error, context, showNotification);
  }

  /**
   * Get error statistics for dashboard or status display
   */
  public getErrorSummary(): {
    totalErrors: number;
    recentErrors: number;
    criticalErrors: number;
    errorsByType: Record<string, number>;
  } {
    const stats = this.coreHandler.getErrorStats();
    const recentErrors = stats.recent.length;
    const criticalErrors = stats.bySeverity[ErrorSeverity.CRITICAL] || 0;

    return {
      totalErrors: stats.total,
      recentErrors,
      criticalErrors,
      errorsByType: stats.byType,
    };
  }
}
