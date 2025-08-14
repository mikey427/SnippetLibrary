import {
  SnippetInterface,
  StorageLocation,
  StorageChange,
  Result,
  StorageConfigInterface,
} from "../../types";

/**
 * Interface for storage service operations
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
   * Watch for external changes to storage files
   */
  watchChanges(callback: (changes: StorageChange[]) => void): Result<void>;

  /**
   * Stop watching for changes
   */
  stopWatching(): Result<void>;

  /**
   * Get current storage location
   */
  getStorageLocation(): Result<StorageLocation>;

  /**
   * Set storage location
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
   * Check if storage location exists and is accessible
   */
  checkStorageAccess(): Promise<Result<boolean>>;

  /**
   * Create backup of current snippets
   */
  createBackup(): Promise<Result<string>>;

  /**
   * List available backups
   */
  listBackups(): Promise<Result<string[]>>;

  /**
   * Restore from backup
   */
  restoreFromBackup(backupPath: string): Promise<Result<SnippetInterface[]>>;

  /**
   * Initialize storage (create directories, default files)
   */
  initialize(): Promise<Result<void>>;

  /**
   * Clean up resources
   */
  dispose(): void;
}
