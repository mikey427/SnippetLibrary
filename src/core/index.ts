/**
 * Shared core library exports
 * This module provides the business logic that can be shared between
 * the VS Code extension and the web GUI
 */

// Export all types
export * from "../types";

// Export all interfaces
export * from "../interfaces/SnippetManager";
export * from "../interfaces/StorageService";

// Export utility functions
export * from "./utils";
export * from "./validation";

// Export models
export * from "./models";

// Export services (excluding conflicting names)
export {
  FileSystemStorageService,
  SnippetManagerImpl,
  UsageStatistics,
  SearchService,
  SearchResult,
  SearchMatch,
  SearchSuggestion,
  SearchHistoryEntry,
  RealTimeSearchManager,
  SearchEvent,
  SearchMetrics,
  createRealTimeSearchManager,
  SearchQueryBuilder,
  AdvancedSearchFilter,
  AdvancedSearchQuery,
  SavedSearch,
  SearchPatterns,
  createStorageService,
  createWorkspaceStorageService,
  createGlobalStorageService,
} from "./services";
