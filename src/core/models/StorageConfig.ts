import {
  StorageConfig as IStorageConfig,
  Result,
  ErrorType,
} from "../../types";
import { createError, isEmpty } from "../utils";
import * as path from "path";

/**
 * StorageConfig class with location and format validation
 */
export class StorageConfig implements IStorageConfig {
  public location: "workspace" | "global";
  public path?: string;
  public format: "json" | "yaml";
  public autoBackup: boolean;
  public backupInterval: number;

  constructor(config: Partial<IStorageConfig> = {}) {
    // Validate the config before creating
    const validation = StorageConfig.validate(config);
    if (!validation.success) {
      throw new Error(`Invalid storage config: ${validation.error.message}`);
    }

    this.location = config.location || "global";
    this.path = config.path;
    this.format = config.format || "json";
    this.autoBackup =
      config.autoBackup !== undefined ? config.autoBackup : true;
    this.backupInterval = config.backupInterval || 3600000; // 1 hour in milliseconds
  }

  /**
   * Create default global storage config
   */
  static createGlobal(): StorageConfig {
    return new StorageConfig({
      location: "global",
      format: "json",
      autoBackup: true,
      backupInterval: 3600000,
    });
  }

  /**
   * Create default workspace storage config
   */
  static createWorkspace(workspacePath?: string): StorageConfig {
    return new StorageConfig({
      location: "workspace",
      path: workspacePath,
      format: "json",
      autoBackup: true,
      backupInterval: 3600000,
    });
  }

  /**
   * Create config from VS Code settings
   */
  static fromVSCodeConfig(config: any): Result<StorageConfig> {
    try {
      return {
        success: true,
        data: new StorageConfig({
          location: config.storageLocation || "global",
          format: config.storageFormat || "json",
          autoBackup:
            config.autoBackup !== undefined ? config.autoBackup : true,
          backupInterval: config.backupInterval || 3600000,
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Failed to create storage config from VS Code settings",
          { config, error: error instanceof Error ? error.message : error },
          true,
          "Check your VS Code settings for the snippet library extension"
        ),
      };
    }
  }

  /**
   * Validate storage configuration
   */
  static validate(config: any): Result<boolean> {
    if (!config || typeof config !== "object") {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Storage config must be an object",
          { config },
          true,
          "Provide a valid storage configuration object"
        ),
      };
    }

    // Validate location
    if (config.location !== undefined) {
      const validLocations = ["workspace", "global"];
      if (!validLocations.includes(config.location)) {
        return {
          success: false,
          error: createError(
            ErrorType.validation,
            `Storage location must be one of: ${validLocations.join(", ")}`,
            { location: config.location },
            true,
            "Use either 'workspace' or 'global' for storage location"
          ),
        };
      }
    }

    // Validate path
    if (config.path !== undefined) {
      if (typeof config.path !== "string" || isEmpty(config.path)) {
        return {
          success: false,
          error: createError(
            ErrorType.validation,
            "Storage path must be a non-empty string",
            { path: config.path },
            true,
            "Provide a valid file system path"
          ),
        };
      }

      // Basic path validation
      if (!path.isAbsolute(config.path) && config.location === "global") {
        return {
          success: false,
          error: createError(
            ErrorType.validation,
            "Global storage path must be absolute",
            { path: config.path },
            true,
            "Provide an absolute path for global storage"
          ),
        };
      }
    }

    // Validate format
    if (config.format !== undefined) {
      const validFormats = ["json", "yaml"];
      if (!validFormats.includes(config.format)) {
        return {
          success: false,
          error: createError(
            ErrorType.validation,
            `Storage format must be one of: ${validFormats.join(", ")}`,
            { format: config.format },
            true,
            "Use either 'json' or 'yaml' for storage format"
          ),
        };
      }
    }

    // Validate autoBackup
    if (
      config.autoBackup !== undefined &&
      typeof config.autoBackup !== "boolean"
    ) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Auto backup setting must be a boolean",
          { autoBackup: config.autoBackup },
          true,
          "Set autoBackup to true or false"
        ),
      };
    }

    // Validate backupInterval
    if (config.backupInterval !== undefined) {
      if (
        typeof config.backupInterval !== "number" ||
        config.backupInterval < 60000
      ) {
        return {
          success: false,
          error: createError(
            ErrorType.validation,
            "Backup interval must be a number >= 60000 (1 minute)",
            { backupInterval: config.backupInterval },
            true,
            "Set backup interval to at least 60000 milliseconds (1 minute)"
          ),
        };
      }
    }

    return { success: true, data: true };
  }

  /**
   * Validate the current config
   */
  validate(): Result<boolean> {
    return StorageConfig.validate(this.toPlainObject());
  }

  /**
   * Update the configuration
   */
  update(updates: Partial<IStorageConfig>): Result<void> {
    // Create a temporary object with the updates to validate
    const updatedConfig = {
      ...this.toPlainObject(),
      ...updates,
    };

    const validation = StorageConfig.validate(updatedConfig);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Apply the updates
    if (updates.location !== undefined) this.location = updates.location;
    if (updates.path !== undefined) this.path = updates.path;
    if (updates.format !== undefined) this.format = updates.format;
    if (updates.autoBackup !== undefined) this.autoBackup = updates.autoBackup;
    if (updates.backupInterval !== undefined)
      this.backupInterval = updates.backupInterval;

    return { success: true, data: undefined };
  }

  /**
   * Get the file extension based on format
   */
  getFileExtension(): string {
    return this.format === "yaml" ? ".yaml" : ".json";
  }

  /**
   * Get the default filename for snippets
   */
  getSnippetsFilename(): string {
    return `snippets${this.getFileExtension()}`;
  }

  /**
   * Get the backup filename with timestamp
   */
  getBackupFilename(timestamp?: Date): string {
    const date = timestamp || new Date();
    const dateStr = date.toISOString().replace(/[:.]/g, "-");
    return `snippets-backup-${dateStr}${this.getFileExtension()}`;
  }

  /**
   * Check if backup is due
   */
  isBackupDue(lastBackupTime: Date): boolean {
    if (!this.autoBackup) return false;
    const now = new Date();
    return now.getTime() - lastBackupTime.getTime() >= this.backupInterval;
  }

  /**
   * Get storage directory path
   */
  getStorageDirectory(): string {
    if (this.path) {
      return path.dirname(this.path);
    }

    if (this.location === "workspace") {
      return ".vscode/snippets";
    }

    // Global storage - this would typically be resolved by the storage service
    return "~/.vscode/extensions/snippet-library";
  }

  /**
   * Get full storage file path
   */
  getStorageFilePath(): string {
    if (this.path) {
      return this.path;
    }

    const directory = this.getStorageDirectory();
    const filename = this.getSnippetsFilename();
    return path.join(directory, filename);
  }

  /**
   * Clone the current config
   */
  clone(): StorageConfig {
    return new StorageConfig(this.toPlainObject());
  }

  /**
   * Convert to plain object
   */
  toPlainObject(): IStorageConfig {
    return {
      location: this.location,
      path: this.path,
      format: this.format,
      autoBackup: this.autoBackup,
      backupInterval: this.backupInterval,
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): IStorageConfig {
    return this.toPlainObject();
  }

  /**
   * Check if two configs are equal
   */
  equals(other: StorageConfig): boolean {
    return (
      this.location === other.location &&
      this.path === other.path &&
      this.format === other.format &&
      this.autoBackup === other.autoBackup &&
      this.backupInterval === other.backupInterval
    );
  }
}
