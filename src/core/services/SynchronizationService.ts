import { EventEmitter } from "events";
import {
  SnippetInterface,
  StorageChange,
  Result,
  ErrorType,
  SnippetError,
} from "../../types";

/**
 * Synchronization event types
 */
export interface SyncEvent {
  type:
    | "snippet_changed"
    | "conflict_detected"
    | "sync_completed"
    | "sync_failed";
  data: any;
  timestamp: Date;
  source: "vscode" | "webgui" | "filesystem";
}

/**
 * Conflict resolution strategy
 */
export interface ConflictResolution {
  strategy: "local_wins" | "remote_wins" | "merge" | "manual";
  snippet?: SnippetInterface;
}

/**
 * Synchronization configuration
 */
export interface SyncConfig {
  enableFileWatching: boolean;
  enableWebSocketSync: boolean;
  conflictResolution: "local_wins" | "remote_wins" | "prompt_user";
  autoRefreshInterval?: number; // milliseconds
  maxRetries: number;
}

/**
 * Interface for synchronization service
 */
export interface SynchronizationService {
  /**
   * Initialize synchronization
   */
  initialize(config: SyncConfig): Promise<Result<void>>;

  /**
   * Start synchronization services
   */
  start(): Promise<Result<void>>;

  /**
   * Stop synchronization services
   */
  stop(): Promise<Result<void>>;

  /**
   * Manually trigger synchronization
   */
  sync(): Promise<Result<void>>;

  /**
   * Register for synchronization events
   */
  onSyncEvent(callback: (event: SyncEvent) => void): void;

  /**
   * Remove synchronization event listener
   */
  offSyncEvent(callback: (event: SyncEvent) => void): void;

  /**
   * Handle storage changes from file system
   */
  handleStorageChange(change: StorageChange): Promise<Result<void>>;

  /**
   * Handle snippet updates from VS Code
   */
  handleVSCodeUpdate(
    snippet: SnippetInterface,
    action: "created" | "updated" | "deleted"
  ): Promise<Result<void>>;

  /**
   * Handle snippet updates from Web GUI
   */
  handleWebGUIUpdate(
    snippet: SnippetInterface,
    action: "created" | "updated" | "deleted"
  ): Promise<Result<void>>;

  /**
   * Resolve conflicts between different sources
   */
  resolveConflict(
    localSnippet: SnippetInterface,
    remoteSnippet: SnippetInterface,
    resolution?: ConflictResolution
  ): Promise<Result<SnippetInterface>>;

  /**
   * Get current synchronization status
   */
  getStatus(): {
    isRunning: boolean;
    lastSync: Date | null;
    pendingChanges: number;
    conflicts: number;
  };

  /**
   * Dispose resources
   */
  dispose(): void;
}

/**
 * Implementation of synchronization service
 */
export class SynchronizationServiceImpl
  extends EventEmitter
  implements SynchronizationService
{
  private config: SyncConfig;
  private isRunning = false;
  private lastSync: Date | null = null;
  private pendingChanges: StorageChange[] = [];
  private conflicts: Map<
    string,
    { local: SnippetInterface; remote: SnippetInterface }
  > = new Map();
  private syncInProgress = false;
  private retryCount = 0;
  private autoRefreshTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.config = {
      enableFileWatching: true,
      enableWebSocketSync: true,
      conflictResolution: "prompt_user",
      maxRetries: 3,
    };
  }

  async initialize(config: SyncConfig): Promise<Result<void>> {
    try {
      this.config = { ...this.config, ...config };

      // Set up auto-refresh if configured
      if (
        this.config.autoRefreshInterval &&
        this.config.autoRefreshInterval > 0
      ) {
        this.setupAutoRefresh();
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: `Failed to initialize synchronization service: ${error}`,
          recoverable: true,
          suggestedAction: "Check configuration and try again",
        },
      };
    }
  }

  async start(): Promise<Result<void>> {
    try {
      if (this.isRunning) {
        return {
          success: false,
          error: {
            type: ErrorType.unknown,
            message: "Synchronization service is already running",
            recoverable: true,
          },
        };
      }

      this.isRunning = true;
      this.retryCount = 0;

      // Emit start event
      this.emitSyncEvent({
        type: "sync_completed",
        data: { message: "Synchronization service started" },
        timestamp: new Date(),
        source: "filesystem",
      });

      return { success: true, data: undefined };
    } catch (error) {
      this.isRunning = false;
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: `Failed to start synchronization service: ${error}`,
          recoverable: true,
          suggestedAction: "Check system resources and try again",
        },
      };
    }
  }

  async stop(): Promise<Result<void>> {
    try {
      this.isRunning = false;

      // Clear auto-refresh timer
      if (this.autoRefreshTimer) {
        clearInterval(this.autoRefreshTimer);
        this.autoRefreshTimer = undefined;
      }

      // Clear pending changes and conflicts
      this.pendingChanges = [];
      this.conflicts.clear();

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: `Failed to stop synchronization service: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  async sync(): Promise<Result<void>> {
    if (this.syncInProgress) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: "Synchronization already in progress",
          recoverable: true,
          suggestedAction: "Wait for current sync to complete",
        },
      };
    }

    try {
      this.syncInProgress = true;

      // Process pending changes
      const processedChanges: StorageChange[] = [];
      for (const change of this.pendingChanges) {
        const result = await this.processStorageChange(change);
        if (result.success) {
          processedChanges.push(change);
        }
      }

      // Remove processed changes
      this.pendingChanges = this.pendingChanges.filter(
        (change) => !processedChanges.includes(change)
      );

      this.lastSync = new Date();
      this.retryCount = 0;

      this.emitSyncEvent({
        type: "sync_completed",
        data: {
          processedChanges: processedChanges.length,
          remainingChanges: this.pendingChanges.length,
          conflicts: this.conflicts.size,
        },
        timestamp: new Date(),
        source: "filesystem",
      });

      return { success: true, data: undefined };
    } catch (error) {
      this.retryCount++;

      this.emitSyncEvent({
        type: "sync_failed",
        data: {
          error: error instanceof Error ? error.message : error,
          retryCount: this.retryCount,
        },
        timestamp: new Date(),
        source: "filesystem",
      });

      return {
        success: false,
        error: {
          type: ErrorType.syncConflict,
          message: `Synchronization failed: ${error}`,
          recoverable: this.retryCount < this.config.maxRetries,
          suggestedAction:
            this.retryCount < this.config.maxRetries
              ? "Will retry automatically"
              : "Manual intervention required",
        },
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  onSyncEvent(callback: (event: SyncEvent) => void): void {
    this.on("syncEvent", callback);
  }

  offSyncEvent(callback: (event: SyncEvent) => void): void {
    this.off("syncEvent", callback);
  }

  async handleStorageChange(change: StorageChange): Promise<Result<void>> {
    if (!this.isRunning) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: "Synchronization service is not running",
          recoverable: true,
          suggestedAction: "Start synchronization service",
        },
      };
    }

    try {
      // Add to pending changes
      this.pendingChanges.push(change);

      // Emit change event
      this.emitSyncEvent({
        type: "snippet_changed",
        data: change,
        timestamp: new Date(),
        source: "filesystem",
      });

      // Auto-sync if not in progress
      if (!this.syncInProgress && this.config.enableFileWatching) {
        await this.sync();
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.syncConflict,
          message: `Failed to handle storage change: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  async handleVSCodeUpdate(
    snippet: SnippetInterface,
    action: "created" | "updated" | "deleted"
  ): Promise<Result<void>> {
    try {
      const change: StorageChange = {
        type: action,
        snippet,
        timestamp: new Date(),
      };

      this.emitSyncEvent({
        type: "snippet_changed",
        data: change,
        timestamp: new Date(),
        source: "vscode",
      });

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.syncConflict,
          message: `Failed to handle VS Code update: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  async handleWebGUIUpdate(
    snippet: SnippetInterface,
    action: "created" | "updated" | "deleted"
  ): Promise<Result<void>> {
    try {
      const change: StorageChange = {
        type: action,
        snippet,
        timestamp: new Date(),
      };

      this.emitSyncEvent({
        type: "snippet_changed",
        data: change,
        timestamp: new Date(),
        source: "webgui",
      });

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.syncConflict,
          message: `Failed to handle Web GUI update: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  async resolveConflict(
    localSnippet: SnippetInterface,
    remoteSnippet: SnippetInterface,
    resolution?: ConflictResolution
  ): Promise<Result<SnippetInterface>> {
    try {
      let resolvedSnippet: SnippetInterface;

      if (resolution) {
        switch (resolution.strategy) {
          case "local_wins":
            resolvedSnippet = localSnippet;
            break;
          case "remote_wins":
            resolvedSnippet = remoteSnippet;
            break;
          case "merge":
            resolvedSnippet = this.mergeSnippets(localSnippet, remoteSnippet);
            break;
          case "manual":
            resolvedSnippet = resolution.snippet || localSnippet;
            break;
          default:
            resolvedSnippet = localSnippet;
        }
      } else {
        // Use default conflict resolution strategy
        switch (this.config.conflictResolution) {
          case "local_wins":
            resolvedSnippet = localSnippet;
            break;
          case "remote_wins":
            resolvedSnippet = remoteSnippet;
            break;
          case "prompt_user":
            // Store conflict for user resolution
            this.conflicts.set(localSnippet.id, {
              local: localSnippet,
              remote: remoteSnippet,
            });

            this.emitSyncEvent({
              type: "conflict_detected",
              data: {
                snippetId: localSnippet.id,
                local: localSnippet,
                remote: remoteSnippet,
              },
              timestamp: new Date(),
              source: "filesystem",
            });

            // Return local snippet as temporary resolution
            resolvedSnippet = localSnippet;
            break;
          default:
            resolvedSnippet = localSnippet;
        }
      }

      // Remove from conflicts if resolved
      if (resolution) {
        this.conflicts.delete(localSnippet.id);
      }

      return { success: true, data: resolvedSnippet };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.syncConflict,
          message: `Failed to resolve conflict: ${error}`,
          recoverable: true,
          suggestedAction: "Try manual conflict resolution",
        },
      };
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      pendingChanges: this.pendingChanges.length,
      conflicts: this.conflicts.size,
    };
  }

  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }

  private setupAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }

    this.autoRefreshTimer = setInterval(async () => {
      if (
        this.isRunning &&
        !this.syncInProgress &&
        this.pendingChanges.length > 0
      ) {
        await this.sync();
      }
    }, this.config.autoRefreshInterval);
  }

  private async processStorageChange(
    change: StorageChange
  ): Promise<Result<void>> {
    try {
      // This would integrate with the actual storage service and snippet manager
      // For now, we'll just simulate processing

      // In a real implementation, this would:
      // 1. Validate the change
      // 2. Check for conflicts with existing data
      // 3. Apply the change to the storage
      // 4. Notify other components

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.syncConflict,
          message: `Failed to process storage change: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  private mergeSnippets(
    local: SnippetInterface,
    remote: SnippetInterface
  ): SnippetInterface {
    // Simple merge strategy: use the most recently updated snippet as base
    // and merge non-conflicting fields
    const base = local.updatedAt > remote.updatedAt ? local : remote;
    const other = local.updatedAt > remote.updatedAt ? remote : local;

    return {
      ...base,
      // Merge tags (union of both sets)
      tags: Array.from(new Set([...base.tags, ...other.tags])),
      // Use higher usage count
      usageCount: Math.max(base.usageCount, other.usageCount),
      // Update timestamp to now
      updatedAt: new Date(),
    };
  }

  private emitSyncEvent(event: SyncEvent): void {
    this.emit("syncEvent", event);
  }
}
