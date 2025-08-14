import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "js-yaml";
import { FSWatcher } from "fs";
import {
  SnippetInterface,
  StorageLocation,
  StorageChange,
  Result,
  ErrorType,
  StorageConfigInterface,
  ExportData,
} from "../../types";
import { StorageService } from "./StorageService";
import { StorageConfig } from "../models/StorageConfig";
import { createError, generateId } from "../utils";

/**
 * File system based storage service implementation
 */
export class FileSystemStorageService implements StorageService {
  private config: StorageConfig;
  private watcher: FSWatcher | null = null;
  private watchCallback: ((changes: StorageChange[]) => void) | null = null;

  constructor(config?: Partial<StorageConfigInterface>) {
    this.config = new StorageConfig(config);
  }

  /**
   * Load all snippets from storage
   */
  async loadSnippets(): Promise<Result<SnippetInterface[]>> {
    try {
      const filePath = this.getSnippetsFilePath();

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        // Return empty array if file doesn't exist
        return { success: true, data: [] };
      }

      const fileContent = await fs.promises.readFile(filePath, "utf-8");

      if (!fileContent.trim()) {
        return { success: true, data: [] };
      }

      let parsedData: any;

      if (this.config.format === "yaml") {
        parsedData = yaml.load(fileContent);
      } else {
        parsedData = JSON.parse(fileContent);
      }

      // Handle different data formats
      let snippets: SnippetInterface[];

      if (Array.isArray(parsedData)) {
        snippets = parsedData;
      } else if (
        parsedData &&
        parsedData.snippets &&
        Array.isArray(parsedData.snippets)
      ) {
        // Handle export format
        snippets = parsedData.snippets;
      } else {
        return {
          success: false,
          error: createError(
            ErrorType.storageAccess,
            "Invalid snippets file format",
            { filePath, format: this.config.format },
            true,
            "Check the snippets file format and ensure it contains a valid array of snippets"
          ),
        };
      }

      // Validate and convert dates
      const validatedSnippets = snippets.map((snippet: any) => ({
        ...snippet,
        createdAt: new Date(snippet.createdAt),
        updatedAt: new Date(snippet.updatedAt),
        tags: Array.isArray(snippet.tags) ? snippet.tags : [],
        usageCount:
          typeof snippet.usageCount === "number" ? snippet.usageCount : 0,
      }));

      return { success: true, data: validatedSnippets };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to load snippets from storage",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check file permissions and ensure the storage location is accessible"
        ),
      };
    }
  }

  /**
   * Save snippets to storage
   */
  async saveSnippets(snippets: SnippetInterface[]): Promise<Result<void>> {
    try {
      const filePath = this.getSnippetsFilePath();
      const directory = path.dirname(filePath);

      // Ensure directory exists
      await fs.promises.mkdir(directory, { recursive: true });

      // Create export format with metadata
      const exportData: ExportData = {
        snippets,
        metadata: {
          exportedAt: new Date(),
          version: "1.0.0",
          count: snippets.length,
        },
      };

      let fileContent: string;

      if (this.config.format === "yaml") {
        fileContent = yaml.dump(exportData, { indent: 2 });
      } else {
        fileContent = JSON.stringify(exportData, null, 2);
      }

      await fs.promises.writeFile(filePath, fileContent, "utf-8");

      // Create backup if enabled
      if (this.config.autoBackup) {
        await this.createBackupIfDue();
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to save snippets to storage",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check file permissions and ensure the storage location is writable"
        ),
      };
    }
  }

  /**
   * Watch for external changes to storage files
   */
  watchChanges(callback: (changes: StorageChange[]) => void): Result<void> {
    try {
      if (this.watcher) {
        this.stopWatching();
      }

      const filePath = this.getSnippetsFilePath();
      const directory = path.dirname(filePath);

      // Ensure directory exists before watching
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      this.watchCallback = callback;
      this.watcher = fs.watch(
        directory,
        { persistent: false },
        (eventType, filename) => {
          if (filename === path.basename(filePath)) {
            // File changed, load and compare
            this.handleFileChange();
          }
        }
      );

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to start watching storage changes",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check file system permissions and ensure the storage location is accessible"
        ),
      };
    }
  }

  /**
   * Stop watching for changes
   */
  stopWatching(): Result<void> {
    try {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
        this.watchCallback = null;
      }
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to stop watching storage changes",
          { error: error instanceof Error ? error.message : error },
          false
        ),
      };
    }
  }

  /**
   * Get current storage location
   */
  getStorageLocation(): Result<StorageLocation> {
    try {
      const filePath = this.getSnippetsFilePath();
      return {
        success: true,
        data: {
          type: this.config.location,
          path: filePath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to get storage location",
          { error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Set storage location
   */
  async setStorageLocation(location: StorageLocation): Promise<Result<void>> {
    try {
      // Create new config with updated location
      const newConfig = this.config.clone();
      const updateResult = newConfig.update({
        location: location.type,
        path: location.path,
      });

      if (!updateResult.success) {
        return updateResult;
      }

      // Test access to new location
      const directory = path.dirname(location.path);
      await fs.promises.mkdir(directory, { recursive: true });
      await fs.promises.access(directory, fs.constants.W_OK);

      // Update config
      this.config = newConfig;

      // Restart watching if it was active
      if (this.watcher && this.watchCallback) {
        const callback = this.watchCallback;
        this.stopWatching();
        this.watchChanges(callback);
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to set storage location",
          { location, error: error instanceof Error ? error.message : error },
          true,
          "Ensure the target location is writable and accessible"
        ),
      };
    }
  }

  /**
   * Get storage configuration
   */
  getConfig(): StorageConfigInterface {
    return this.config.toPlainObject();
  }

  /**
   * Update storage configuration
   */
  async updateConfig(
    configUpdates: Partial<StorageConfigInterface>
  ): Promise<Result<void>> {
    try {
      const updateResult = this.config.update(configUpdates);
      if (!updateResult.success) {
        return updateResult;
      }

      // If location changed, restart watching
      if (
        (configUpdates.location || configUpdates.path) &&
        this.watcher &&
        this.watchCallback
      ) {
        const callback = this.watchCallback;
        this.stopWatching();
        this.watchChanges(callback);
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Failed to update storage configuration",
          {
            configUpdates,
            error: error instanceof Error ? error.message : error,
          },
          true,
          "Check the configuration values and ensure they are valid"
        ),
      };
    }
  }

  /**
   * Check if storage location exists and is accessible
   */
  async checkStorageAccess(): Promise<Result<boolean>> {
    try {
      const filePath = this.getSnippetsFilePath();
      const directory = path.dirname(filePath);

      // Check if directory exists or can be created
      await fs.promises.mkdir(directory, { recursive: true });

      // Check write access
      await fs.promises.access(directory, fs.constants.W_OK);

      // Check if file exists and is readable
      if (fs.existsSync(filePath)) {
        await fs.promises.access(filePath, fs.constants.R_OK);
      }

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Storage location is not accessible",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check file permissions and ensure the storage location exists and is writable"
        ),
      };
    }
  }

  /**
   * Create backup of current snippets
   */
  async createBackup(): Promise<Result<string>> {
    try {
      const snippetsResult = await this.loadSnippets();
      if (!snippetsResult.success) {
        return {
          success: false,
          error: snippetsResult.error,
        };
      }

      const backupPath = this.getBackupFilePath();
      const directory = path.dirname(backupPath);

      // Ensure backup directory exists
      await fs.promises.mkdir(directory, { recursive: true });

      // Create export data
      const exportData: ExportData = {
        snippets: snippetsResult.data,
        metadata: {
          exportedAt: new Date(),
          version: "1.0.0",
          count: snippetsResult.data.length,
        },
      };

      let fileContent: string;

      if (this.config.format === "yaml") {
        fileContent = yaml.dump(exportData, { indent: 2 });
      } else {
        fileContent = JSON.stringify(exportData, null, 2);
      }

      await fs.promises.writeFile(backupPath, fileContent, "utf-8");

      return { success: true, data: backupPath };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to create backup",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check file permissions and ensure the backup location is writable"
        ),
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Result<string[]>> {
    try {
      const backupDirectory = this.getBackupDirectory();

      if (!fs.existsSync(backupDirectory)) {
        return { success: true, data: [] };
      }

      const files = await fs.promises.readdir(backupDirectory);
      const backupFiles = files
        .filter((file) => file.startsWith("snippets-backup-"))
        .map((file) => path.join(backupDirectory, file))
        .sort((a, b) => {
          // Sort by modification time, newest first
          const statA = fs.statSync(a);
          const statB = fs.statSync(b);
          return statB.mtime.getTime() - statA.mtime.getTime();
        });

      return { success: true, data: backupFiles };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to list backups",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check file permissions and ensure the backup location is accessible"
        ),
      };
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(
    backupPath: string
  ): Promise<Result<SnippetInterface[]>> {
    try {
      if (!fs.existsSync(backupPath)) {
        return {
          success: false,
          error: createError(
            ErrorType.storageAccess,
            "Backup file does not exist",
            { backupPath },
            false,
            "Check the backup file path and ensure it exists"
          ),
        };
      }

      const fileContent = await fs.promises.readFile(backupPath, "utf-8");

      let parsedData: any;

      if (backupPath.endsWith(".yaml") || backupPath.endsWith(".yml")) {
        parsedData = yaml.load(fileContent);
      } else {
        parsedData = JSON.parse(fileContent);
      }

      // Handle different data formats
      let snippets: SnippetInterface[];

      if (Array.isArray(parsedData)) {
        snippets = parsedData;
      } else if (
        parsedData &&
        parsedData.snippets &&
        Array.isArray(parsedData.snippets)
      ) {
        snippets = parsedData.snippets;
      } else {
        return {
          success: false,
          error: createError(
            ErrorType.storageAccess,
            "Invalid backup file format",
            { backupPath },
            false,
            "Ensure the backup file contains valid snippet data"
          ),
        };
      }

      // Validate and convert dates
      const validatedSnippets = snippets.map((snippet: any) => ({
        ...snippet,
        createdAt: new Date(snippet.createdAt),
        updatedAt: new Date(snippet.updatedAt),
        tags: Array.isArray(snippet.tags) ? snippet.tags : [],
        usageCount:
          typeof snippet.usageCount === "number" ? snippet.usageCount : 0,
      }));

      return { success: true, data: validatedSnippets };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to restore from backup",
          { backupPath, error: error instanceof Error ? error.message : error },
          true,
          "Check the backup file format and ensure it's a valid snippet backup"
        ),
      };
    }
  }

  /**
   * Initialize storage (create directories, default files)
   */
  async initialize(): Promise<Result<void>> {
    try {
      const filePath = this.getSnippetsFilePath();
      const directory = path.dirname(filePath);

      // Create directory structure
      await fs.promises.mkdir(directory, { recursive: true });

      // Create backup directory
      const backupDirectory = this.getBackupDirectory();
      await fs.promises.mkdir(backupDirectory, { recursive: true });

      // Create empty snippets file if it doesn't exist
      if (!fs.existsSync(filePath)) {
        const emptyData: ExportData = {
          snippets: [],
          metadata: {
            exportedAt: new Date(),
            version: "1.0.0",
            count: 0,
          },
        };

        let fileContent: string;

        if (this.config.format === "yaml") {
          fileContent = yaml.dump(emptyData, { indent: 2 });
        } else {
          fileContent = JSON.stringify(emptyData, null, 2);
        }

        await fs.promises.writeFile(filePath, fileContent, "utf-8");
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to initialize storage",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check file permissions and ensure the storage location is writable"
        ),
      };
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopWatching();
  }

  // Private helper methods

  private getSnippetsFilePath(): string {
    return this.resolveStoragePath(this.config.getStorageFilePath());
  }

  private getBackupDirectory(): string {
    const storageDir = path.dirname(this.getSnippetsFilePath());
    return path.join(storageDir, "backups");
  }

  private getBackupFilePath(): string {
    const backupDir = this.getBackupDirectory();
    const filename = this.config.getBackupFilename();
    return path.join(backupDir, filename);
  }

  private resolveStoragePath(storagePath: string): string {
    if (path.isAbsolute(storagePath)) {
      return storagePath;
    }

    if (this.config.location === "global") {
      // Resolve global path relative to user home
      return path.resolve(os.homedir(), storagePath.replace(/^~\//, ""));
    }

    // Workspace path - resolve relative to current working directory
    return path.resolve(process.cwd(), storagePath);
  }

  private async handleFileChange(): Promise<void> {
    if (!this.watchCallback) return;

    try {
      // Simple implementation - just notify that changes occurred
      // In a more sophisticated implementation, we could compare before/after
      // and provide specific change details
      const changes: StorageChange[] = [
        {
          type: "updated",
          snippet: {} as SnippetInterface, // Placeholder - would need actual change detection
          timestamp: new Date(),
        },
      ];

      this.watchCallback(changes);
    } catch (error) {
      // Log error but don't throw - file watching should be resilient
      console.error("Error handling file change:", error);
    }
  }

  private async createBackupIfDue(): Promise<void> {
    try {
      const backupFiles = await this.listBackups();
      if (!backupFiles.success) return;

      if (backupFiles.data.length === 0) {
        // No backups exist, create one
        await this.createBackup();
        return;
      }

      // Check if backup is due based on the most recent backup
      const mostRecentBackup = backupFiles.data[0];
      const stat = await fs.promises.stat(mostRecentBackup);

      if (this.config.isBackupDue(stat.mtime)) {
        await this.createBackup();
      }
    } catch (error) {
      // Don't throw - backup creation should not fail the main operation
      console.error("Error creating automatic backup:", error);
    }
  }
}
