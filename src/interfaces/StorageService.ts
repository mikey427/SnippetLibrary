import {
  Snippet,
  StorageLocation,
  StorageChange,
  StorageConfig,
  Result,
} from "../types";

/**
 * Interface for storage operations
 */
export interface StorageService {
  /**
   * Load all snippets from storage
   */
  loadSnippets(): Promise<Result<Snippet[]>>;

  /**
   * Save snippets to storage
   */
  saveSnippets(snippets: Snippet[]): Promise<Result<void>>;

  /**
   * Save a single snippet
   */
  saveSnippet(snippet: Snippet): Promise<Result<void>>;

  /**
   * Delete a snippet from storage
   */
  deleteSnippet(id: string): Promise<Result<void>>;

  /**
   * Watch for external changes to storage files
   */
  watchChanges(callback: (changes: StorageChange[]) => void): void;

  /**
   * Stop watching for changes
   */
  stopWatching(): void;

  /**
   * Get current storage location
   */
  getStorageLocation(): StorageLocation;

  /**
   * Set storage location and migrate data if needed
   */
  setStorageLocation(location: StorageLocation): Promise<Result<void>>;

  /**
   * Get storage configuration
   */
  getConfig(): StorageConfig;

  /**
   * Update storage configuration
   */
  updateConfig(config: Partial<StorageConfig>): Promise<Result<void>>;

  /**
   * Create backup of current snippets
   */
  createBackup(): Promise<Result<string>>;

  /**
   * Restore from backup file
   */
  restoreFromBackup(backupPath: string): Promise<Result<void>>;

  /**
   * Check if storage is accessible and writable
   */
  checkStorageHealth(): Promise<Result<boolean>>;
}
