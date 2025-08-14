import {
  SnippetInterface,
  StorageLocation,
  StorageChange,
  StorageConfigInterface,
  Result,
} from "../types";

/**
 * Interface for storage operations
 */
export interface StorageService {
  /**
   * Load all snippets from storage
   */
  loadSnippets(): Promise<Result<SnippetInterface[]>>;

  /**
   * Save snippets to storage
   */
  saveSnippets(snippets: SnippetInterface[]): Promise<Result<void>>;

  /**
   * Save a single snippet
   */
  saveSnippet(snippet: SnippetInterface): Promise<Result<void>>;

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
  getConfig(): StorageConfigInterface;

  /**
   * Update storage configuration
   */
  updateConfig(config: Partial<StorageConfigInterface>): Promise<Result<void>>;

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
