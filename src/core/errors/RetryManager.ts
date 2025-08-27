import { SnippetLibraryError } from "./SnippetLibraryError";
import { ErrorLogger } from "./ErrorLogger";
import { ErrorType } from "./ErrorTypes";

export interface RetryConfig {
  readonly maxRetries: number;
  readonly initialDelay: number;
  readonly maxDelay: number;
  readonly exponentialBackoff: boolean;
  readonly retryableErrors: ErrorType[];
  readonly jitter: boolean;
}

export interface RetryAttempt {
  readonly attemptNumber: number;
  readonly delay: number;
  readonly error?: SnippetLibraryError;
  readonly timestamp: Date;
}

export interface RetryResult<T> {
  readonly success: boolean;
  readonly result?: T;
  readonly error?: SnippetLibraryError;
  readonly attempts: RetryAttempt[];
  readonly totalDuration: number;
}

/**
 * Automatic retry manager for transient failures
 */
export class RetryManager {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    exponentialBackoff: true,
    retryableErrors: [
      ErrorType.NETWORK,
      ErrorType.STORAGE_ACCESS,
      ErrorType.SYNC_CONFLICT,
    ],
    jitter: true,
  };

  private logger: ErrorLogger;

  constructor(private config: RetryConfig = RetryManager.DEFAULT_CONFIG) {
    this.logger = ErrorLogger.getInstance();
  }

  /**
   * Execute an operation with automatic retry
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = { ...this.config, ...customConfig };
    const attempts: RetryAttempt[] = [];
    const startTime = Date.now();

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      const attemptStart = Date.now();

      try {
        this.logger.logDebug(
          `Executing ${operationName}, attempt ${attempt + 1}`
        );

        const result = await operation();

        const attemptRecord: RetryAttempt = {
          attemptNumber: attempt + 1,
          delay: 0,
          timestamp: new Date(attemptStart),
        };
        attempts.push(attemptRecord);

        this.logger.logInfo(
          `${operationName} succeeded on attempt ${attempt + 1}`
        );

        return {
          success: true,
          result,
          attempts,
          totalDuration: Date.now() - startTime,
        };
      } catch (error) {
        const snippetError = this.normalizeError(error);

        const attemptRecord: RetryAttempt = {
          attemptNumber: attempt + 1,
          delay: 0,
          error: snippetError,
          timestamp: new Date(attemptStart),
        };
        attempts.push(attemptRecord);

        this.logger.logError(snippetError, {
          component: "RetryManager",
          operation: operationName,
        });

        // Check if error is retryable
        if (!this.isRetryableError(snippetError, config)) {
          this.logger.logWarning(
            `${operationName} failed with non-retryable error: ${snippetError.message}`
          );

          return {
            success: false,
            error: snippetError,
            attempts,
            totalDuration: Date.now() - startTime,
          };
        }

        // Check if we've exhausted retries
        if (attempt >= config.maxRetries) {
          this.logger.logError(
            SnippetLibraryError.snippetOperation(
              `${operationName} failed after ${config.maxRetries + 1} attempts`,
              { originalError: snippetError, attempts }
            )
          );

          return {
            success: false,
            error: snippetError,
            attempts,
            totalDuration: Date.now() - startTime,
          };
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, config);

        // Update the attempt record with the delay (create new object since delay is readonly)
        const updatedAttemptRecord: RetryAttempt = {
          ...attemptRecord,
          delay: delay,
        };

        // Replace the last attempt record with the updated one
        attempts[attempts.length - 1] = updatedAttemptRecord;

        this.logger.logWarning(
          `${operationName} failed on attempt ${
            attempt + 1
          }, retrying in ${delay}ms`
        );

        await this.sleep(delay);
      }
    }

    // This should never be reached, but included for completeness
    const finalError = SnippetLibraryError.snippetOperation(
      `${operationName} failed unexpectedly`
    );

    return {
      success: false,
      error: finalError,
      attempts,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Check if an error is retryable based on configuration
   */
  private isRetryableError(
    error: SnippetLibraryError,
    config: RetryConfig
  ): boolean {
    return config.retryableErrors.includes(error.type) && error.recoverable;
  }

  /**
   * Calculate delay for next retry attempt
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.initialDelay;

    if (config.exponentialBackoff) {
      delay = Math.min(
        config.initialDelay * Math.pow(2, attempt),
        config.maxDelay
      );
    }

    // Add jitter to prevent thundering herd
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += Math.random() * jitterAmount - jitterAmount / 2;
    }

    return Math.floor(delay);
  }

  /**
   * Convert any error to SnippetLibraryError
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

    return SnippetLibraryError.snippetOperation("Unknown error occurred", {
      originalError: error,
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a retry manager with custom configuration
   */
  public static withConfig(config: Partial<RetryConfig>): RetryManager {
    return new RetryManager({ ...RetryManager.DEFAULT_CONFIG, ...config });
  }

  /**
   * Create a retry manager for network operations
   */
  public static forNetwork(): RetryManager {
    return new RetryManager({
      ...RetryManager.DEFAULT_CONFIG,
      maxRetries: 5,
      initialDelay: 500,
      retryableErrors: [ErrorType.NETWORK],
    });
  }

  /**
   * Create a retry manager for storage operations
   */
  public static forStorage(): RetryManager {
    return new RetryManager({
      ...RetryManager.DEFAULT_CONFIG,
      maxRetries: 3,
      initialDelay: 1000,
      retryableErrors: [ErrorType.STORAGE_ACCESS],
    });
  }
}
