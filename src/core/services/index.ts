// Export all service interfaces and implementations
export { StorageService } from "./StorageService";
export { FileSystemStorageService } from "./FileSystemStorageService";
export { SnippetManager, UsageStatistics } from "./SnippetManager";
export { SnippetManagerImpl } from "./SnippetManagerImpl";

// Export search and filtering services
export {
  SearchService,
  SearchResult,
  SearchMatch,
  SearchSuggestion,
  SearchHistoryEntry,
} from "./SearchService";
export {
  RealTimeSearchManager,
  SearchEvent,
  SearchMetrics,
  createRealTimeSearchManager,
} from "./RealTimeSearchManager";
export {
  SearchQueryBuilder,
  AdvancedSearchFilter,
  AdvancedSearchQuery,
  SavedSearch,
  SearchPatterns,
} from "./SearchQueryBuilder";

// Export import/export services
export {
  ImportExportService,
  ExportOptions,
  ImportOptions,
  BackupOptions,
  FileFormat,
} from "./ImportExportService";

// Export synchronization services
export {
  SynchronizationService,
  SynchronizationServiceImpl,
  SyncConfig,
  SyncEvent,
} from "./SynchronizationService";
export {
  FileSystemWatcher,
  FileSystemWatcherImpl,
  FileWatcherConfig,
  FileChangeEvent,
} from "./FileSystemWatcher";
export {
  WebSocketSyncService,
  WebSocketSyncServiceImpl,
  WebSocketSyncConfig,
  WebSocketMessage,
  WebSocketClient,
} from "./WebSocketSyncService";
export {
  ConflictResolutionService,
  ConflictResolutionServiceImpl,
  ConflictType,
  Conflict,
  ResolutionStrategy,
  ResolutionResult,
} from "./ConflictResolutionService";
export {
  SynchronizationCoordinator,
  SynchronizationCoordinatorImpl,
  SyncCoordinatorConfig,
  SyncStatus,
} from "./SynchronizationCoordinator";

// Export factory functions
import { FileSystemStorageService } from "./FileSystemStorageService";
import { StorageConfigInterface } from "../../types";

/**
 * Create a storage service with optional configuration
 */
export function createStorageService(
  config?: Partial<StorageConfigInterface>
): FileSystemStorageService {
  return new FileSystemStorageService(config);
}

/**
 * Create a workspace-scoped storage service
 */
export function createWorkspaceStorageService(
  customPath?: string
): FileSystemStorageService {
  const config: Partial<StorageConfigInterface> = {
    location: "workspace",
    format: "json",
    autoBackup: true,
  };

  if (customPath) {
    config.path = customPath.endsWith(".json")
      ? customPath
      : `${customPath}/snippets.json`;
  }

  return new FileSystemStorageService(config);
}

/**
 * Create a global storage service
 */
export function createGlobalStorageService(): FileSystemStorageService {
  return new FileSystemStorageService({
    location: "global",
    format: "json",
    autoBackup: true,
  });
}
