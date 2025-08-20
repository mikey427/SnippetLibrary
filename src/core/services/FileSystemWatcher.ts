import * as fs from "fs";
import * as path from "path";
import { EventEmitter } from "events";
import {
  SnippetInterface,
  StorageChange,
  Result,
  ErrorType,
} from "../../types";

/**
 * File system watcher configuration
 */
export interface FileWatcherConfig {
  watchPath: string;
  debounceMs: number;
  recursive: boolean;
  ignorePatterns: string[];
}

/**
 * File change event
 */
export interface FileChangeEvent {
  type: "created" | "updated" | "deleted" | "renamed";
  filePath: string;
  timestamp: Date;
  stats?: fs.Stats;
}

/**
 * Interface for file system watching
 */
export interface FileSystemWatcher {
  /**
   * Start watching the configured path
   */
  start(): Promise<Result<void>>;

  /**
   * Stop watching
   */
  stop(): Promise<Result<void>>;

  /**
   * Check if watcher is active
   */
  isWatching(): boolean;

  /**
   * Register callback for file changes
   */
  onFileChange(callback: (event: FileChangeEvent) => void): void;

  /**
   * Remove file change callback
   */
  offFileChange(callback: (event: FileChangeEvent) => void): void;

  /**
   * Register callback for storage changes (parsed file changes)
   */
  onStorageChange(callback: (change: StorageChange) => void): void;

  /**
   * Remove storage change callback
   */
  offStorageChange(callback: (change: StorageChange) => void): void;

  /**
   * Manually check for changes
   */
  checkForChanges(): Promise<Result<FileChangeEvent[]>>;

  /**
   * Dispose resources
   */
  dispose(): void;
}

/**
 * Implementation of file system watcher
 */
export class FileSystemWatcherImpl
  extends EventEmitter
  implements FileSystemWatcher
{
  private config: FileWatcherConfig;
  private watcher: fs.FSWatcher | null = null;
  private isActive = false;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private lastModified = new Map<string, number>();

  constructor(config: FileWatcherConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<Result<void>> {
    try {
      if (this.isActive) {
        return {
          success: false,
          error: {
            type: ErrorType.unknown,
            message: "File watcher is already active",
            recoverable: true,
          },
        };
      }

      // Check if watch path exists
      if (!fs.existsSync(this.config.watchPath)) {
        return {
          success: false,
          error: {
            type: ErrorType.storageAccess,
            message: `Watch path does not exist: ${this.config.watchPath}`,
            recoverable: true,
            suggestedAction: "Create the directory or update the path",
          },
        };
      }

      // Start watching
      this.watcher = fs.watch(
        this.config.watchPath,
        { recursive: this.config.recursive },
        (eventType, filename) => {
          if (filename) {
            this.handleFileSystemEvent(eventType, filename);
          }
        }
      );

      this.watcher.on("error", (error) => {
        console.error("File watcher error:", error);
        this.emit("error", error);
      });

      this.isActive = true;

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.storageAccess,
          message: `Failed to start file watcher: ${error}`,
          recoverable: true,
          suggestedAction: "Check file system permissions",
        },
      };
    }
  }

  async stop(): Promise<Result<void>> {
    try {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
      }

      // Clear all debounce timers
      this.debounceTimers.forEach((timer) => clearTimeout(timer));
      this.debounceTimers.clear();

      this.isActive = false;

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: `Failed to stop file watcher: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  isWatching(): boolean {
    return this.isActive;
  }

  onFileChange(callback: (event: FileChangeEvent) => void): void {
    this.on("fileChange", callback);
  }

  offFileChange(callback: (event: FileChangeEvent) => void): void {
    this.off("fileChange", callback);
  }

  onStorageChange(callback: (change: StorageChange) => void): void {
    this.on("storageChange", callback);
  }

  offStorageChange(callback: (change: StorageChange) => void): void {
    this.off("storageChange", callback);
  }

  async checkForChanges(): Promise<Result<FileChangeEvent[]>> {
    try {
      const changes: FileChangeEvent[] = [];

      if (!fs.existsSync(this.config.watchPath)) {
        return { success: true, data: changes };
      }

      const files = await this.getAllFiles(this.config.watchPath);

      for (const filePath of files) {
        if (this.shouldIgnoreFile(filePath)) {
          continue;
        }

        try {
          const stats = fs.statSync(filePath);
          const lastMod = this.lastModified.get(filePath);
          const currentMod = stats.mtime.getTime();

          if (!lastMod) {
            // New file
            changes.push({
              type: "created",
              filePath,
              timestamp: new Date(),
              stats,
            });
            this.lastModified.set(filePath, currentMod);
          } else if (currentMod > lastMod) {
            // Modified file
            changes.push({
              type: "updated",
              filePath,
              timestamp: new Date(),
              stats,
            });
            this.lastModified.set(filePath, currentMod);
          }
        } catch (error) {
          // File might have been deleted
          if (this.lastModified.has(filePath)) {
            changes.push({
              type: "deleted",
              filePath,
              timestamp: new Date(),
            });
            this.lastModified.delete(filePath);
          }
        }
      }

      // Check for deleted files
      for (const [filePath] of this.lastModified) {
        if (!fs.existsSync(filePath)) {
          changes.push({
            type: "deleted",
            filePath,
            timestamp: new Date(),
          });
          this.lastModified.delete(filePath);
        }
      }

      return { success: true, data: changes };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.storageAccess,
          message: `Failed to check for changes: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }

  private handleFileSystemEvent(eventType: string, filename: string): void {
    const filePath = path.join(this.config.watchPath, filename);

    // Skip ignored files
    if (this.shouldIgnoreFile(filePath)) {
      return;
    }

    // Debounce rapid file changes
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.processFileChange(eventType, filePath);
      this.debounceTimers.delete(filePath);
    }, this.config.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private async processFileChange(
    eventType: string,
    filePath: string
  ): Promise<void> {
    try {
      let changeType: "created" | "updated" | "deleted" | "renamed";
      let stats: fs.Stats | undefined;

      // Determine change type
      if (fs.existsSync(filePath)) {
        stats = fs.statSync(filePath);
        const lastMod = this.lastModified.get(filePath);

        if (!lastMod) {
          changeType = "created";
        } else {
          changeType = "updated";
        }

        this.lastModified.set(filePath, stats.mtime.getTime());
      } else {
        changeType = "deleted";
        this.lastModified.delete(filePath);
      }

      const fileChangeEvent: FileChangeEvent = {
        type: changeType,
        filePath,
        timestamp: new Date(),
        stats,
      };

      // Emit file change event
      this.emit("fileChange", fileChangeEvent);

      // Try to parse as snippet file and emit storage change
      if (this.isSnippetFile(filePath)) {
        const storageChange = await this.parseSnippetFile(filePath, changeType);
        if (storageChange) {
          this.emit("storageChange", storageChange);
        }
      }
    } catch (error) {
      console.error("Error processing file change:", error);
    }
  }

  private shouldIgnoreFile(filePath: string): boolean {
    const fileName = path.basename(filePath);

    // Check ignore patterns
    for (const pattern of this.config.ignorePatterns) {
      if (fileName.includes(pattern) || filePath.includes(pattern)) {
        return true;
      }
    }

    // Ignore temporary files, hidden files, etc.
    if (
      fileName.startsWith(".") ||
      fileName.includes("~") ||
      fileName.endsWith(".tmp")
    ) {
      return true;
    }

    return false;
  }

  private isSnippetFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".json" || ext === ".yaml" || ext === ".yml";
  }

  private async parseSnippetFile(
    filePath: string,
    changeType: "created" | "updated" | "deleted"
  ): Promise<StorageChange | null> {
    try {
      if (changeType === "deleted") {
        // For deleted files, we can't parse content, so create a placeholder
        return {
          type: "deleted",
          snippet: {
            id: path.basename(filePath, path.extname(filePath)),
            title: "Deleted Snippet",
            description: "",
            code: "",
            language: "",
            tags: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
          },
          timestamp: new Date(),
        };
      }

      const content = fs.readFileSync(filePath, "utf8");
      let data: any;

      // Parse based on file extension
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".json") {
        data = JSON.parse(content);
      } else if (ext === ".yaml" || ext === ".yml") {
        // For YAML parsing, we'd need a YAML library
        // For now, assume JSON format
        data = JSON.parse(content);
      } else {
        return null;
      }

      // Handle different data formats
      let snippets: SnippetInterface[] = [];

      if (Array.isArray(data)) {
        snippets = data;
      } else if (data.snippets && Array.isArray(data.snippets)) {
        snippets = data.snippets;
      } else if (data.id) {
        // Single snippet
        snippets = [data];
      }

      // For simplicity, return the first snippet found
      // In a real implementation, this would handle multiple snippets
      if (snippets.length > 0) {
        const snippet = snippets[0];

        // Ensure required fields
        if (!snippet.id || !snippet.title || !snippet.code) {
          return null;
        }

        return {
          type: changeType,
          snippet: {
            ...snippet,
            createdAt: new Date(snippet.createdAt || Date.now()),
            updatedAt: new Date(snippet.updatedAt || Date.now()),
            tags: snippet.tags || [],
            usageCount: snippet.usageCount || 0,
          },
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      console.error("Error parsing snippet file:", error);
      return null;
    }
  }

  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory() && this.config.recursive) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (stats.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }
}
