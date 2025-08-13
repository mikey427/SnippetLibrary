import {
  Snippet,
  StorageLocation,
  StorageChange,
  Result,
  StorageConfig as IStorageConfig,
} from "../../types";

/**
 * Interface for storage service operations
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
  getConfig(): IStorageConfig;

  /**
   * Update storage configuration
   */
  updateConfig(config: Partial<IStorageConfig>): Promise<Result<void>>;

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
  restoreFromBackup(backupPath: string): Promise<Result<Snippet[]>>;

  /**
   * Initialize storage (create directories, default files)
   */
  initialize(): Promise<Result<void>>;

  /**
   * Clean up resources
   */
  dispose(): void;
}
