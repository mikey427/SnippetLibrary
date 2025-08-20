/**
 * Core data model for a code snippet
 */
export interface SnippetInterface {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
  category?: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  prefix?: string; // For VS Code snippet integration
  scope?: string[]; // File types where snippet is available
}

/**
 * Data structure for creating or updating snippets
 */
export interface SnippetData {
  title: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
  category?: string;
  prefix?: string;
  scope?: string[];
}

/**
 * Search query parameters for filtering snippets
 */
export interface SearchQueryInterface {
  text?: string;
  language?: string;
  tags?: string[];
  category?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: "title" | "createdAt" | "usageCount";
  sortOrder?: "asc" | "desc";
}

/**
 * Configuration for snippet storage
 */
export interface StorageConfigInterface {
  location: "workspace" | "global";
  path?: string;
  format: "json" | "yaml";
  autoBackup: boolean;
  backupInterval: number;
  maxBackups?: number;
}

/**
 * Web GUI configuration
 */
export interface WebGUIConfig {
  port: number;
  host: string;
  autoStart: boolean;
  autoShutdown: boolean;
  openInBrowser: boolean;
  theme: "auto" | "light" | "dark";
}

/**
 * Keybinding configuration
 */
export interface KeybindingConfig {
  saveSnippet: string;
  insertSnippet: string;
  manageSnippets: string;
  openWebGUI: string;
  quickSearch: string;
}

/**
 * Editor integration configuration
 */
export interface EditorConfig {
  enableIntelliSense: boolean;
  enableAutoComplete: boolean;
  showPreview: boolean;
  insertMode: "replace" | "insert";
}

/**
 * Search configuration
 */
export interface SearchConfig {
  fuzzySearch: boolean;
  caseSensitive: boolean;
  maxResults: number;
  searchHistory: boolean;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  showSaveConfirmation: boolean;
  showImportSummary: boolean;
  showBackupNotifications: boolean;
}

/**
 * Complete extension configuration
 */
export interface ExtensionConfig {
  storage: StorageConfigInterface;
  webGUI: WebGUIConfig;
  keybindings: KeybindingConfig;
  editor: EditorConfig;
  search: SearchConfig;
  notifications: NotificationConfig;
}

/**
 * Storage location information
 */
export interface StorageLocation {
  type: "workspace" | "global";
  path: string;
}

/**
 * Result of import operation
 */
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  conflicts: ConflictResolution[];
}

/**
 * Data structure for import operations
 */
export interface ImportData {
  snippets: SnippetData[];
  conflictResolution: "skip" | "overwrite" | "rename";
}

/**
 * Export filter options
 */
export interface ExportFilter {
  tags?: string[];
  categories?: string[];
  languages?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Export data structure
 */
export interface ExportData {
  snippets: SnippetInterface[];
  metadata: {
    exportedAt: Date;
    version: string;
    count: number;
  };
}

/**
 * Conflict resolution for imports
 */
export interface ConflictResolution {
  existingSnippet: SnippetInterface;
  newSnippet: SnippetData;
  resolution: "skip" | "overwrite" | "rename";
  newName?: string;
}

/**
 * Storage change notification
 */
export interface StorageChange {
  type: "created" | "updated" | "deleted";
  snippet: SnippetInterface;
  timestamp: Date;
}

/**
 * Error types for the snippet library system
 */
export enum ErrorType {
  storageAccess = "storage_access",
  validation = "validation",
  syncConflict = "sync_conflict",
  network = "network",
  unknown = "unknown",
}

/**
 * Structured error information
 */
export interface SnippetError {
  type: ErrorType;
  message: string;
  details?: any;
  recoverable: boolean;
  suggestedAction?: string;
}

/**
 * Result wrapper for operations that may fail
 */
export type Result<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: SnippetError;
    };

// Type aliases for backward compatibility and cleaner imports
export type Snippet = SnippetInterface;
export type SearchQuery = SearchQueryInterface;
export type StorageConfig = StorageConfigInterface;
