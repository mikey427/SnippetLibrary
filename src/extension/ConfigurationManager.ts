import * as vscode from "vscode";
import { StorageConfigInterface } from "../types";

/**
 * Manages VS Code configuration for the snippet library
 */
export class ConfigurationManager {
  private static readonly CONFIGURATION_SECTION = "snippetLibrary";

  /**
   * Get the current storage configuration
   */
  getStorageConfig(): StorageConfigInterface {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );

    return {
      location: config.get<"workspace" | "global">("storageLocation", "global"),
      format: config.get<"json" | "yaml">("storageFormat", "json"),
      autoBackup: config.get<boolean>("autoBackup", true),
      backupInterval: config.get<number>("backupInterval", 24 * 60 * 60 * 1000), // 24 hours in ms
      path: config.get<string>("customStoragePath"),
    };
  }

  /**
   * Get storage location setting
   */
  getStorageLocation(): "workspace" | "global" {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    return config.get<"workspace" | "global">("storageLocation", "global");
  }

  /**
   * Get storage format setting
   */
  getStorageFormat(): "json" | "yaml" {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    return config.get<"json" | "yaml">("storageFormat", "json");
  }

  /**
   * Get auto backup setting
   */
  getAutoBackup(): boolean {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    return config.get<boolean>("autoBackup", true);
  }

  /**
   * Get backup interval setting (in milliseconds)
   */
  getBackupInterval(): number {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    return config.get<number>("backupInterval", 24 * 60 * 60 * 1000); // Default 24 hours
  }

  /**
   * Get custom storage path setting
   */
  getCustomStoragePath(): string | undefined {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    return config.get<string>("customStoragePath");
  }

  /**
   * Get web GUI port setting
   */
  getWebGUIPort(): number {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    return config.get<number>("webGUIPort", 3000);
  }

  /**
   * Get web GUI auto-launch setting
   */
  getWebGUIAutoLaunch(): boolean {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    return config.get<boolean>("webGUIAutoLaunch", false);
  }

  /**
   * Update a configuration value
   */
  async updateConfig<T>(
    key: string,
    value: T,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    await config.update(
      key,
      value,
      target || vscode.ConfigurationTarget.Global
    );
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );

    const defaultSettings = [
      { key: "storageLocation", value: "global" },
      { key: "storageFormat", value: "json" },
      { key: "autoBackup", value: true },
      { key: "backupInterval", value: 24 * 60 * 60 * 1000 },
      { key: "webGUIPort", value: 3000 },
      { key: "webGUIAutoLaunch", value: false },
    ];

    for (const setting of defaultSettings) {
      await config.update(
        setting.key,
        setting.value,
        vscode.ConfigurationTarget.Global
      );
    }
  }

  /**
   * Get all configuration values
   */
  getAllConfig(): { [key: string]: any } {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    return {
      storageLocation: config.get("storageLocation"),
      storageFormat: config.get("storageFormat"),
      autoBackup: config.get("autoBackup"),
      backupInterval: config.get("backupInterval"),
      customStoragePath: config.get("customStoragePath"),
      webGUIPort: config.get("webGUIPort"),
      webGUIAutoLaunch: config.get("webGUIAutoLaunch"),
    };
  }

  /**
   * Validate configuration values
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = this.getAllConfig();

    // Validate storage location
    if (!["workspace", "global"].includes(config.storageLocation)) {
      errors.push("Invalid storage location. Must be 'workspace' or 'global'.");
    }

    // Validate storage format
    if (!["json", "yaml"].includes(config.storageFormat)) {
      errors.push("Invalid storage format. Must be 'json' or 'yaml'.");
    }

    // Validate backup interval
    if (
      typeof config.backupInterval !== "number" ||
      config.backupInterval < 0
    ) {
      errors.push("Invalid backup interval. Must be a positive number.");
    }

    // Validate web GUI port
    if (
      typeof config.webGUIPort !== "number" ||
      config.webGUIPort < 1 ||
      config.webGUIPort > 65535
    ) {
      errors.push(
        "Invalid web GUI port. Must be a number between 1 and 65535."
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get configuration schema for documentation
   */
  getConfigurationSchema(): any {
    return {
      type: "object",
      title: "Snippet Library Configuration",
      properties: {
        storageLocation: {
          type: "string",
          enum: ["workspace", "global"],
          default: "global",
          description: "Where to store snippets",
        },
        storageFormat: {
          type: "string",
          enum: ["json", "yaml"],
          default: "json",
          description: "File format for snippet storage",
        },
        autoBackup: {
          type: "boolean",
          default: true,
          description: "Automatically backup snippets",
        },
        backupInterval: {
          type: "number",
          default: 86400000,
          description: "Backup interval in milliseconds (default: 24 hours)",
        },
        customStoragePath: {
          type: "string",
          description: "Custom path for snippet storage (optional)",
        },
        webGUIPort: {
          type: "number",
          default: 3000,
          minimum: 1,
          maximum: 65535,
          description: "Port for the web GUI server",
        },
        webGUIAutoLaunch: {
          type: "boolean",
          default: false,
          description: "Automatically launch web GUI on extension activation",
        },
      },
    };
  }
}
