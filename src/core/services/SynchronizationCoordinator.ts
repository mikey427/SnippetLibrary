import { EventEmitter } from "events";
import { Server } from "http";
import {
  SynchronizationService,
  SynchronizationServiceImpl,
  SyncConfig,
  SyncEvent,
} from "./SynchronizationService";
import {
  FileSystemWatcher,
  FileSystemWatcherImpl,
  FileWatcherConfig,
} from "./FileSystemWatcher";
import {
  WebSocketSyncService,
  WebSocketSyncServiceImpl,
  WebSocketSyncConfig,
  WebSocketMessage,
} from "./WebSocketSyncService";
import {
  ConflictResolutionService,
  ConflictResolutionServiceImpl,
  Conflict,
  ResolutionStrategy,
} from "./ConflictResolutionService";
import { SnippetManager } from "../../interfaces/SnippetManager";
import {
  SnippetInterface,
  StorageChange,
  Result,
  ErrorType,
} from "../../types";

/**
 * Synchronization coordinator configuration
 */
export interface SyncCoordinatorConfig {
  sync: SyncConfig;
  fileWatcher: FileWatcherConfig;
  webSocket: WebSocketSyncConfig;
  enableAutoSync: boolean;
  enableConflictResolution: boolean;
  syncInterval?: number; // milliseconds
}

/**
 * Synchronization status
 */
export interface SyncStatus {
  isActive: boolean;
  lastSync: Date | null;
  pendingChanges: number;
  conflicts: number;
  connectedClients: number;
  fileWatcherActive: boolean;
  webSocketActive: boolean;
}

/**
 * Interface for synchronization coordinator
 */
export interface SynchronizationCoordinator {
  /**
   * Initialize all synchronization services
   */
  initialize(
    config: SyncCoordinatorConfig,
    snippetManager: SnippetManager,
    httpServer?: Server
  ): Promise<Result<void>>;

  /**
   * Start all synchronization services
   */
  start(): Promise<Result<void>>;

  /**
   * Stop all synchronization services
   */
  stop(): Promise<Result<void>>;

  /**
   * Manually trigger synchronization
   */
  sync(): Promise<Result<void>>;

  /**
   * Handle snippet update from VS Code
   */
  handleVSCodeUpdate(
    snippet: SnippetInterface,
    action: "created" | "updated" | "deleted"
  ): Promise<Result<void>>;

  /**
   * Handle snippet update from Web GUI
   */
  handleWebGUIUpdate(
    snippet: SnippetInterface,
    action: "created" | "updated" | "deleted"
  ): Promise<Result<void>>;

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): Conflict[];

  /**
   * Resolve a specific conflict
   */
  resolveConflict(
    conflictId: string,
    strategy: ResolutionStrategy
  ): Promise<Result<void>>;

  /**
   * Auto-resolve all resolvable conflicts
   */
  autoResolveConflicts(): Promise<Result<number>>;

  /**
   * Get synchronization status
   */
  getStatus(): SyncStatus;

  /**
   * Register for synchronization events
   */
  onSyncEvent(callback: (event: SyncEvent) => void): void;

  /**
   * Register for conflict events
   */
  onConflictDetected(callback: (conflict: Conflict) => void): void;

  /**
   * Dispose all resources
   */
  dispose(): void;
}

/**
 * Implementation of synchronization coordinator
 */
export class SynchronizationCoordinatorImpl
  extends EventEmitter
  implements SynchronizationCoordinator
{
  private config: SyncCoordinatorConfig | null = null;
  private snippetManager: SnippetManager | null = null;

  private syncService: SynchronizationService;
  private fileWatcher: FileSystemWatcher;
  private webSocketService: WebSocketSyncService;
  private conflictResolver: ConflictResolutionService;

  private isInitialized = false;
  private isActive = false;
  private syncTimer?: NodeJS.Timeout;

  constructor() {
    super();

    this.syncService = new SynchronizationServiceImpl();
    this.fileWatcher = new FileSystemWatcherImpl({
      watchPath: "",
      debounceMs: 1000,
      recursive: true,
      ignorePatterns: [".git", "node_modules", ".tmp"],
    });
    this.webSocketService = new WebSocketSyncServiceImpl();
    this.conflictResolver = new ConflictResolutionServiceImpl();
  }

  async initialize(
    config: SyncCoordinatorConfig,
    snippetManager: SnippetManager,
    httpServer?: Server
  ): Promise<Result<void>> {
    try {
      this.config = config;
      this.snippetManager = snippetManager;

      // Initialize synchronization service
      const syncResult = await this.syncService.initialize(config.sync);
      if (!syncResult.success) {
        return syncResult;
      }

      // Initialize file watcher
      this.fileWatcher = new FileSystemWatcherImpl(config.fileWatcher);

      // Initialize WebSocket service if HTTP server is provided
      if (httpServer && config.webSocket) {
        const wsResult = await this.webSocketService.initialize(
          httpServer,
          config.webSocket
        );
        if (!wsResult.success) {
          return wsResult;
        }
      }

      // Set up event handlers
      this.setupEventHandlers();

      // Set up periodic sync if configured
      if (config.enableAutoSync && config.syncInterval) {
        this.setupPeriodicSync(config.syncInterval);
      }

      this.isInitialized = true;

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: `Failed to initialize synchronization coordinator: ${error}`,
          recoverable: true,
          suggestedAction: "Check configuration and dependencies",
        },
      };
    }
  }

  async start(): Promise<Result<void>> {
    if (!this.isInitialized || !this.config) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: "Synchronization coordinator not initialized",
          recoverable: true,
          suggestedAction: "Call initialize() first",
        },
      };
    }

    try {
      // Start synchronization service
      const syncResult = await this.syncService.start();
      if (!syncResult.success) {
        return syncResult;
      }

      // Start file watcher if enabled
      if (this.config.fileWatcher.watchPath) {
        const watchResult = await this.fileWatcher.start();
        if (!watchResult.success) {
          console.warn(
            "Failed to start file watcher:",
            watchResult.error.message
          );
        }
      }

      // Start WebSocket service if configured
      if (this.config.webSocket) {
        const wsResult = await this.webSocketService.start();
        if (!wsResult.success) {
          console.warn(
            "Failed to start WebSocket service:",
            wsResult.error.message
          );
        }
      }

      this.isActive = true;

      // Emit start event
      this.emit("syncEvent", {
        type: "sync_completed",
        data: { message: "Synchronization coordinator started" },
        timestamp: new Date(),
        source: "filesystem",
      });

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: `Failed to start synchronization coordinator: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  async stop(): Promise<Result<void>> {
    try {
      this.isActive = false;

      // Clear periodic sync timer
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = undefined;
      }

      // Stop all services
      await Promise.all([
        this.syncService.stop(),
        this.fileWatcher.stop(),
        this.webSocketService.stop(),
      ]);

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: `Failed to stop synchronization coordinator: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  async sync(): Promise<Result<void>> {
    if (!this.isActive || !this.snippetManager) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: "Synchronization coordinator not active",
          recoverable: true,
          suggestedAction: "Start the coordinator first",
        },
      };
    }

    return await this.syncService.sync();
  }

  async handleVSCodeUpdate(
    snippet: SnippetInterface,
    action: "created" | "updated" | "deleted"
  ): Promise<Result<void>> {
    if (!this.isActive) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: "Synchronization coordinator not active",
          recoverable: true,
        },
      };
    }

    try {
      // Handle the update in the sync service
      const result = await this.syncService.handleVSCodeUpdate(snippet, action);
      if (!result.success) {
        return result;
      }

      // Broadcast to WebSocket clients
      this.webSocketService.broadcastSnippetUpdate(snippet, action);

      // Check for conflicts if this is an update
      if (action === "updated" && this.config?.enableConflictResolution) {
        await this.checkForConflicts(snippet, "vscode");
      }

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
    if (!this.isActive) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: "Synchronization coordinator not active",
          recoverable: true,
        },
      };
    }

    try {
      // Handle the update in the sync service
      const result = await this.syncService.handleWebGUIUpdate(snippet, action);
      if (!result.success) {
        return result;
      }

      // Broadcast to other WebSocket clients
      this.webSocketService.broadcastSnippetUpdate(snippet, action);

      // Check for conflicts if this is an update
      if (action === "updated" && this.config?.enableConflictResolution) {
        await this.checkForConflicts(snippet, "webgui");
      }

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

  getPendingConflicts(): Conflict[] {
    return this.conflictResolver.getPendingConflicts();
  }

  async resolveConflict(
    conflictId: string,
    strategy: ResolutionStrategy
  ): Promise<Result<void>> {
    try {
      const conflict = this.conflictResolver.getConflict(conflictId);
      if (!conflict) {
        return {
          success: false,
          error: {
            type: ErrorType.validation,
            message: `Conflict not found: ${conflictId}`,
            recoverable: true,
          },
        };
      }

      const result = await this.conflictResolver.resolveConflict(
        conflict,
        strategy
      );
      if (!result.success) {
        return result;
      }

      // Apply the resolved snippet to the snippet manager
      if (this.snippetManager) {
        await this.snippetManager.updateSnippet(
          result.data.resolvedSnippet.id,
          result.data.resolvedSnippet
        );
      }

      // Broadcast the resolution
      this.webSocketService.broadcastSnippetUpdate(
        result.data.resolvedSnippet,
        "updated"
      );

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.syncConflict,
          message: `Failed to resolve conflict: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  async autoResolveConflicts(): Promise<Result<number>> {
    try {
      const conflicts = this.conflictResolver.getPendingConflicts();
      const result = await this.conflictResolver.autoResolveConflicts(
        conflicts
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      // Apply resolved snippets to the snippet manager
      if (this.snippetManager) {
        for (const resolution of result.data) {
          await this.snippetManager.updateSnippet(
            resolution.resolvedSnippet.id,
            resolution.resolvedSnippet
          );

          // Broadcast the resolution
          this.webSocketService.broadcastSnippetUpdate(
            resolution.resolvedSnippet,
            "updated"
          );
        }
      }

      return { success: true, data: result.data.length };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.syncConflict,
          message: `Failed to auto-resolve conflicts: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  getStatus(): SyncStatus {
    const syncStatus = this.syncService.getStatus();
    const wsStatus = this.webSocketService.getStatus();

    return {
      isActive: this.isActive,
      lastSync: syncStatus.lastSync,
      pendingChanges: syncStatus.pendingChanges,
      conflicts: syncStatus.conflicts,
      connectedClients: wsStatus.connectedClients,
      fileWatcherActive: this.fileWatcher.isWatching(),
      webSocketActive: wsStatus.isRunning,
    };
  }

  onSyncEvent(callback: (event: SyncEvent) => void): void {
    this.syncService.onSyncEvent(callback);
  }

  onConflictDetected(callback: (conflict: Conflict) => void): void {
    this.conflictResolver.onConflictDetected(callback);
  }

  dispose(): void {
    this.stop();

    this.syncService.dispose();
    this.fileWatcher.dispose();
    this.webSocketService.dispose();
    this.conflictResolver.dispose();

    this.removeAllListeners();
  }

  private setupEventHandlers(): void {
    // File watcher events
    this.fileWatcher.onStorageChange(async (change: StorageChange) => {
      await this.syncService.handleStorageChange(change);

      // Check for conflicts
      if (this.config?.enableConflictResolution) {
        await this.checkForConflicts(change.snippet, "filesystem");
      }
    });

    // WebSocket events
    this.webSocketService.onMessage(
      async (message: WebSocketMessage, clientId: string) => {
        await this.handleWebSocketMessage(message, clientId);
      }
    );

    // Sync service events
    this.syncService.onSyncEvent((event: SyncEvent) => {
      this.emit("syncEvent", event);

      // Broadcast sync events to WebSocket clients
      this.webSocketService.broadcastSyncEvent(event);
    });

    // Conflict resolution events
    this.conflictResolver.onConflictDetected((conflict: Conflict) => {
      this.emit("conflictDetected", conflict);

      // Notify WebSocket clients about conflicts
      this.webSocketService.broadcastSyncEvent({
        type: "conflict_detected",
        data: conflict,
        timestamp: new Date(),
        source: conflict.source,
      });
    });
  }

  private async handleWebSocketMessage(
    message: WebSocketMessage,
    clientId: string
  ): Promise<void> {
    try {
      switch (message.type) {
        case "sync_request":
          await this.sync();
          break;

        case "conflict_resolution":
          if (message.data.conflictId && message.data.strategy) {
            await this.resolveConflict(
              message.data.conflictId,
              message.data.strategy
            );
          }
          break;

        default:
          console.log(`Unhandled WebSocket message type: ${message.type}`);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  }

  private async checkForConflicts(
    snippet: SnippetInterface,
    source: "vscode" | "webgui" | "filesystem"
  ): Promise<void> {
    if (!this.snippetManager) return;

    try {
      // Get the current version from storage
      const currentSnippetResult = await this.snippetManager.getSnippet(
        snippet.id
      );
      if (!currentSnippetResult.success || !currentSnippetResult.data) return;

      // Check for conflicts
      const conflict = this.conflictResolver.detectConflict(
        currentSnippetResult.data,
        snippet,
        source
      );
      if (conflict) {
        this.conflictResolver.addConflict(conflict);
      }
    } catch (error) {
      console.error("Error checking for conflicts:", error);
    }
  }

  private setupPeriodicSync(interval: number): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      if (this.isActive) {
        await this.sync();
      }
    }, interval);
  }
}
