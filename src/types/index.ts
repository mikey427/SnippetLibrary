/**
 * Core data model for a code snippet
 */
export interface Snippet {
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
export interface SearchQuery {
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
export interface StorageConfig {
  location: "workspace" | "global";
  path?: string;
  format: "json" | "yaml";
  autoBackup: boolean;
  backupInterval: number;
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
  snippets: Snippet[];
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
  existingSnippet: Snippet;
  newSnippet: SnippetData;
  resolution: "skip" | "overwrite" | "rename";
  newName?: string;
}

/**
 * Storage change notification
 */
export interface StorageChange {
  type: "created" | "updated" | "deleted";
  snippet: Snippet;
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
