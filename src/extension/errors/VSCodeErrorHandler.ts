import * as vscode from "vscode";
import {
  ErrorHandler,
  SnippetLibraryError,
  ErrorSeverity,
  ErrorType,
  ErrorContext,
} from "../../core/errors";

/**
 * VS Code specific error handler that integrates with VS Code's notification system
 */
export class VSCodeErrorHandler {
  private coreHandler: ErrorHandler;

  constructor() {
    this.coreHandler = ErrorHandler.getInstance();
  }

  /**
   * Handle error with VS Code notifications
   */
  public async handleError(
    error: any,
    context?: ErrorContext,
    showNotification: boolean = true
  ): Promise<void> {
    const result = await this.coreHandler.handleError(error, context);

    if (showNotification && result.error) {
      await this.showErrorNotification(result.error);
    }
  }

  /**
   * Execute operation with VS Code error handling
   */
  public async executeWithVSCodeErrorHandling<T>(
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
        await this.showErrorNotification(result.error);
      }

      return undefined;
    } catch (error) {
      await this.handleError(error, context, showNotification);
      return undefined;
    }
  }

  /**
   * Show appropriate VS Code notification based on error severity
   */
  private async showErrorNotification(
    error: SnippetLibraryError
  ): Promise<void> {
    const message = this.coreHandler.getUserFriendlyMessage(error);
    const actions = this.coreHandler.getRecoveryActions(error);

    // Create action buttons for manual recovery options
    const actionButtons = actions
      .filter((action) => !action.automatic)
      .slice(0, 3) // Limit to 3 actions to avoid cluttering
      .map((action) => action.label);

    let selectedAction: string | undefined;

    switch (error.severity) {
      case ErrorSeverity.LOW:
        // Show as information message for low severity
        if (actionButtons.length > 0) {
          selectedAction = await vscode.window.showInformationMessage(
            message,
            ...actionButtons,
            "Dismiss"
          );
        } else {
          vscode.window.showInformationMessage(message);
        }
        break;

      case ErrorSeverity.MEDIUM:
        // Show as warning message for medium severity
        if (actionButtons.length > 0) {
          selectedAction = await vscode.window.showWarningMessage(
            message,
            ...actionButtons,
            "Dismiss"
          );
        } else {
          vscode.window.showWarningMessage(message);
        }
        break;

      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        // Show as error message for high/critical severity
        if (actionButtons.length > 0) {
          selectedAction = await vscode.window.showErrorMessage(
            message,
            ...actionButtons,
            "Show Details",
            "Dismiss"
          );
        } else {
          selectedAction = await vscode.window.showErrorMessage(
            message,
            "Show Details",
            "Dismiss"
          );
        }
        break;
    }

    // Handle selected action
    if (selectedAction && selectedAction !== "Dismiss") {
      if (selectedAction === "Show Details") {
        await this.showErrorDetails(error);
      } else {
        // Find and execute the selected recovery action
        const action = actions.find((a) => a.label === selectedAction);
        if (action) {
          await this.executeRecoveryAction(error, action.id);
        }
      }
    }
  }

  /**
   * Show detailed error information in a new document
   */
  private async showErrorDetails(error: SnippetLibraryError): Promise<void> {
    const details = this.formatErrorDetails(error);

    const document = await vscode.workspace.openTextDocument({
      content: details,
      language: "markdown",
    });

    await vscode.window.showTextDocument(document);
  }

  /**
   * Format error details for display
   */
  private formatErrorDetails(error: SnippetLibraryError): string {
    const stats = this.coreHandler.getErrorStats();

    return `# Error Details

## Error Information
- **Type**: ${error.type}
- **Severity**: ${error.severity}
- **Code**: ${error.code}
- **Message**: ${error.message}
- **Recoverable**: ${error.recoverable ? "Yes" : "No"}
- **Timestamp**: ${error.timestamp.toISOString()}

## Suggested Action
${error.suggestedAction || "No specific action suggested"}

## Recovery Options
${this.formatRecoveryOptions(error)}

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
\`\`\`
${error.stack || "No stack trace available"}
\`\`\`

## Original Error
${
  error.originalError
    ? `
**Message**: ${error.originalError.message}
**Stack**: 
\`\`\`
${error.originalError.stack || "No stack trace"}
\`\`\`
`
    : "No original error"
}

## Error Statistics
- **Total Errors**: ${stats.total}
- **By Severity**: ${JSON.stringify(stats.bySeverity, null, 2)}
- **By Type**: ${JSON.stringify(stats.byType, null, 2)}
`;
  }

  /**
   * Format recovery options for display
   */
  private formatRecoveryOptions(error: SnippetLibraryError): string {
    const actions = this.coreHandler.getRecoveryActions(error);

    if (actions.length === 0) {
      return "No recovery options available";
    }

    return actions
      .map((action) => `- **${action.label}**: ${action.description}`)
      .join("\n");
  }

  /**
   * Execute a recovery action with user feedback
   */
  private async executeRecoveryAction(
    error: SnippetLibraryError,
    actionId: string
  ): Promise<void> {
    try {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Executing recovery action...",
          cancellable: false,
        },
        async () => {
          const result = await this.coreHandler.executeRecoveryAction(
            error,
            actionId
          );

          if (result.success) {
            vscode.window.showInformationMessage(
              `Recovery successful: ${result.message}`
            );
          } else {
            vscode.window.showErrorMessage(
              `Recovery failed: ${result.message}`
            );
          }
        }
      );
    } catch (recoveryError) {
      vscode.window.showErrorMessage(
        `Failed to execute recovery action: ${recoveryError}`
      );
    }
  }

  /**
   * Create error context for VS Code operations
   */
  public createVSCodeContext(
    component: string,
    operation: string,
    document?: vscode.TextDocument,
    additionalData?: Record<string, any>
  ): ErrorContext {
    return this.coreHandler.createContext(component, operation, {
      ...additionalData,
      documentUri: document?.uri.toString(),
      documentLanguage: document?.languageId,
      workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.toString(),
    });
  }

  /**
   * Handle command execution errors
   */
  public async handleCommandError(
    commandId: string,
    error: any,
    showNotification: boolean = true
  ): Promise<void> {
    const context = this.createVSCodeContext(
      "CommandHandler",
      commandId,
      vscode.window.activeTextEditor?.document
    );

    await this.handleError(error, context, showNotification);
  }

  /**
   * Handle file operation errors
   */
  public async handleFileOperationError(
    operation: string,
    filePath: string,
    error: any,
    showNotification: boolean = true
  ): Promise<void> {
    const context = this.createVSCodeContext(
      "FileOperations",
      operation,
      undefined,
      { filePath }
    );

    await this.handleError(error, context, showNotification);
  }

  /**
   * Handle snippet operation errors
   */
  public async handleSnippetOperationError(
    operation: string,
    snippetId: string | undefined,
    error: any,
    showNotification: boolean = true
  ): Promise<void> {
    const context = this.createVSCodeContext(
      "SnippetOperations",
      operation,
      vscode.window.activeTextEditor?.document,
      { snippetId }
    );

    await this.handleError(error, context, showNotification);
  }

  /**
   * Get error statistics for status bar or diagnostics
   */
  public getErrorSummary(): {
    totalErrors: number;
    recentErrors: number;
    criticalErrors: number;
  } {
    const stats = this.coreHandler.getErrorStats();
    const recentErrors = stats.recent.length;
    const criticalErrors = stats.bySeverity[ErrorSeverity.CRITICAL] || 0;

    return {
      totalErrors: stats.total,
      recentErrors,
      criticalErrors,
    };
  }
}
