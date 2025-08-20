import * as vscode from "vscode";
import {
  StorageConfigInterface,
  WebGUIConfig,
  KeybindingConfig,
  EditorConfig,
  SearchConfig,
  NotificationConfig,
  ExtensionConfig,
} from "../types";

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
      maxBackups: config.get<number>("maxBackups", 10),
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
   * Get complete web GUI configuration
   */
  getWebGUIConfig(): WebGUIConfig {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    const webGUIConfig = config.get<any>("webGUI", {});

    return {
      port: webGUIConfig.port || config.get<number>("webGUIPort", 3000),
      host: webGUIConfig.host || config.get<string>("webGUIHost", "localhost"),
      autoStart:
        webGUIConfig.autoStart || config.get<boolean>("webGUIAutoStart", false),
      autoShutdown:
        webGUIConfig.autoShutdown !== undefined
          ? webGUIConfig.autoShutdown
          : config.get<boolean>("webGUIAutoShutdown", true),
      openInBrowser:
        webGUIConfig.openInBrowser !== undefined
          ? webGUIConfig.openInBrowser
          : config.get<boolean>("webGUIOpenInBrowser", true),
      theme: webGUIConfig.theme || "auto",
    };
  }

  /**
   * Get keybinding configuration
   */
  getKeybindingConfig(): KeybindingConfig {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    const keybindings = config.get<any>("keybindings", {});

    return {
      saveSnippet: keybindings.saveSnippet || "ctrl+shift+s",
      insertSnippet: keybindings.insertSnippet || "ctrl+shift+i",
      manageSnippets: keybindings.manageSnippets || "ctrl+shift+m",
      openWebGUI: keybindings.openWebGUI || "ctrl+shift+w",
      quickSearch: keybindings.quickSearch || "ctrl+shift+f",
    };
  }

  /**
   * Get editor configuration
   */
  getEditorConfig(): EditorConfig {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    const editor = config.get<any>("editor", {});

    return {
      enableIntelliSense:
        editor.enableIntelliSense !== undefined
          ? editor.enableIntelliSense
          : true,
      enableAutoComplete:
        editor.enableAutoComplete !== undefined
          ? editor.enableAutoComplete
          : true,
      showPreview: editor.showPreview !== undefined ? editor.showPreview : true,
      insertMode: editor.insertMode || "insert",
    };
  }

  /**
   * Get search configuration
   */
  getSearchConfig(): SearchConfig {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    const search = config.get<any>("search", {});

    return {
      fuzzySearch: search.fuzzySearch !== undefined ? search.fuzzySearch : true,
      caseSensitive:
        search.caseSensitive !== undefined ? search.caseSensitive : false,
      maxResults: search.maxResults || 50,
      searchHistory:
        search.searchHistory !== undefined ? search.searchHistory : true,
    };
  }

  /**
   * Get notification configuration
   */
  getNotificationConfig(): NotificationConfig {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );
    const notifications = config.get<any>("notifications", {});

    return {
      showSaveConfirmation:
        notifications.showSaveConfirmation !== undefined
          ? notifications.showSaveConfirmation
          : true,
      showImportSummary:
        notifications.showImportSummary !== undefined
          ? notifications.showImportSummary
          : true,
      showBackupNotifications:
        notifications.showBackupNotifications !== undefined
          ? notifications.showBackupNotifications
          : false,
    };
  }

  /**
   * Get complete extension configuration
   */
  getExtensionConfig(): ExtensionConfig {
    return {
      storage: this.getStorageConfig(),
      webGUI: this.getWebGUIConfig(),
      keybindings: this.getKeybindingConfig(),
      editor: this.getEditorConfig(),
      search: this.getSearchConfig(),
      notifications: this.getNotificationConfig(),
    };
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
   * Update storage configuration
   */
  async updateStorageConfig(
    storageConfig: Partial<StorageConfigInterface>,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    const updates: Promise<void>[] = [];

    if (storageConfig.location !== undefined) {
      updates.push(
        this.updateConfig("storageLocation", storageConfig.location, target)
      );
    }
    if (storageConfig.format !== undefined) {
      updates.push(
        this.updateConfig("storageFormat", storageConfig.format, target)
      );
    }
    if (storageConfig.autoBackup !== undefined) {
      updates.push(
        this.updateConfig("autoBackup", storageConfig.autoBackup, target)
      );
    }
    if (storageConfig.backupInterval !== undefined) {
      updates.push(
        this.updateConfig(
          "backupInterval",
          storageConfig.backupInterval,
          target
        )
      );
    }
    if (storageConfig.maxBackups !== undefined) {
      updates.push(
        this.updateConfig("maxBackups", storageConfig.maxBackups, target)
      );
    }
    if (storageConfig.path !== undefined) {
      updates.push(
        this.updateConfig("customStoragePath", storageConfig.path, target)
      );
    }

    await Promise.all(updates);
  }

  /**
   * Update web GUI configuration
   */
  async updateWebGUIConfig(
    webGUIConfig: Partial<WebGUIConfig>,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    const currentConfig = this.getWebGUIConfig();
    const newConfig = { ...currentConfig, ...webGUIConfig };
    await this.updateConfig("webGUI", newConfig, target);
  }

  /**
   * Update keybinding configuration
   */
  async updateKeybindingConfig(
    keybindingConfig: Partial<KeybindingConfig>,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    const currentConfig = this.getKeybindingConfig();
    const newConfig = { ...currentConfig, ...keybindingConfig };
    await this.updateConfig("keybindings", newConfig, target);
  }

  /**
   * Update editor configuration
   */
  async updateEditorConfig(
    editorConfig: Partial<EditorConfig>,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    const currentConfig = this.getEditorConfig();
    const newConfig = { ...currentConfig, ...editorConfig };
    await this.updateConfig("editor", newConfig, target);
  }

  /**
   * Update search configuration
   */
  async updateSearchConfig(
    searchConfig: Partial<SearchConfig>,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    const currentConfig = this.getSearchConfig();
    const newConfig = { ...currentConfig, ...searchConfig };
    await this.updateConfig("search", newConfig, target);
  }

  /**
   * Update notification configuration
   */
  async updateNotificationConfig(
    notificationConfig: Partial<NotificationConfig>,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    const currentConfig = this.getNotificationConfig();
    const newConfig = { ...currentConfig, ...notificationConfig };
    await this.updateConfig("notifications", newConfig, target);
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
      { key: "maxBackups", value: 10 },
      { key: "customStoragePath", value: undefined },
      {
        key: "webGUI",
        value: {
          port: 3000,
          host: "localhost",
          autoStart: false,
          autoShutdown: true,
          openInBrowser: true,
          theme: "auto",
        },
      },
      {
        key: "keybindings",
        value: {
          saveSnippet: "ctrl+shift+s",
          insertSnippet: "ctrl+shift+i",
          manageSnippets: "ctrl+shift+m",
          openWebGUI: "ctrl+shift+w",
          quickSearch: "ctrl+shift+f",
        },
      },
      {
        key: "editor",
        value: {
          enableIntelliSense: true,
          enableAutoComplete: true,
          showPreview: true,
          insertMode: "insert",
        },
      },
      {
        key: "search",
        value: {
          fuzzySearch: true,
          caseSensitive: false,
          maxResults: 50,
          searchHistory: true,
        },
      },
      {
        key: "notifications",
        value: {
          showSaveConfirmation: true,
          showImportSummary: true,
          showBackupNotifications: false,
        },
      },
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

    try {
      const extensionConfig = this.getExtensionConfig();

      // Validate storage configuration
      if (!["workspace", "global"].includes(extensionConfig.storage.location)) {
        errors.push(
          "Invalid storage location. Must be 'workspace' or 'global'."
        );
      }

      if (!["json", "yaml"].includes(extensionConfig.storage.format)) {
        errors.push("Invalid storage format. Must be 'json' or 'yaml'.");
      }

      if (extensionConfig.storage.backupInterval < 300000) {
        // 5 minutes minimum
        errors.push(
          "Invalid backup interval. Must be at least 5 minutes (300000ms)."
        );
      }

      if (
        extensionConfig.storage.maxBackups &&
        (extensionConfig.storage.maxBackups < 1 ||
          extensionConfig.storage.maxBackups > 100)
      ) {
        errors.push("Invalid max backups. Must be between 1 and 100.");
      }

      // Validate web GUI configuration
      if (
        extensionConfig.webGUI.port < 1024 ||
        extensionConfig.webGUI.port > 65535
      ) {
        errors.push("Invalid web GUI port. Must be between 1024 and 65535.");
      }

      if (!["auto", "light", "dark"].includes(extensionConfig.webGUI.theme)) {
        errors.push(
          "Invalid web GUI theme. Must be 'auto', 'light', or 'dark'."
        );
      }

      // Validate editor configuration
      if (!["replace", "insert"].includes(extensionConfig.editor.insertMode)) {
        errors.push(
          "Invalid editor insert mode. Must be 'replace' or 'insert'."
        );
      }

      // Validate search configuration
      if (
        extensionConfig.search.maxResults < 10 ||
        extensionConfig.search.maxResults > 500
      ) {
        errors.push("Invalid search max results. Must be between 10 and 500.");
      }
    } catch (error) {
      errors.push(
        `Configuration validation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Listen for configuration changes
   */
  onConfigurationChanged(
    callback: (event: vscode.ConfigurationChangeEvent) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(ConfigurationManager.CONFIGURATION_SECTION)
      ) {
        callback(event);
      }
    });
  }

  /**
   * Check if a specific configuration key has changed
   */
  hasConfigurationChanged(
    event: vscode.ConfigurationChangeEvent,
    key: string
  ): boolean {
    return event.affectsConfiguration(
      `${ConfigurationManager.CONFIGURATION_SECTION}.${key}`
    );
  }

  /**
   * Migrate old configuration format to new format
   */
  async migrateConfiguration(): Promise<void> {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIGURATION_SECTION
    );

    // Check for old format configurations and migrate them
    const oldWebGUIPort = config.get<number>("webGUIPort");
    const oldWebGUIHost = config.get<string>("webGUIHost");
    const oldWebGUIAutoStart = config.get<boolean>("webGUIAutoStart");
    const oldWebGUIAutoShutdown = config.get<boolean>("webGUIAutoShutdown");
    const oldWebGUIOpenInBrowser = config.get<boolean>("webGUIOpenInBrowser");

    if (
      oldWebGUIPort !== undefined ||
      oldWebGUIHost !== undefined ||
      oldWebGUIAutoStart !== undefined ||
      oldWebGUIAutoShutdown !== undefined ||
      oldWebGUIOpenInBrowser !== undefined
    ) {
      // Migrate to new webGUI object format
      const webGUIConfig = {
        port: oldWebGUIPort || 3000,
        host: oldWebGUIHost || "localhost",
        autoStart: oldWebGUIAutoStart || false,
        autoShutdown:
          oldWebGUIAutoShutdown !== undefined ? oldWebGUIAutoShutdown : true,
        openInBrowser:
          oldWebGUIOpenInBrowser !== undefined ? oldWebGUIOpenInBrowser : true,
        theme: "auto" as const,
      };

      await this.updateConfig("webGUI", webGUIConfig);

      // Remove old configuration keys
      const oldKeys = [
        "webGUIPort",
        "webGUIHost",
        "webGUIAutoStart",
        "webGUIAutoShutdown",
        "webGUIOpenInBrowser",
      ];
      for (const key of oldKeys) {
        await config.update(key, undefined, vscode.ConfigurationTarget.Global);
      }
    }
  }

  /**
   * Export configuration to JSON
   */
  exportConfiguration(): string {
    const config = this.getExtensionConfig();
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  async importConfiguration(
    configJson: string,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    try {
      const config = JSON.parse(configJson) as ExtensionConfig;

      // Validate the imported configuration
      const tempManager = new ConfigurationManager();
      // Temporarily set the configuration to validate it
      await this.updateStorageConfig(config.storage, target);
      await this.updateWebGUIConfig(config.webGUI, target);
      await this.updateKeybindingConfig(config.keybindings, target);
      await this.updateEditorConfig(config.editor, target);
      await this.updateSearchConfig(config.search, target);
      await this.updateNotificationConfig(config.notifications, target);

      const validation = this.validateConfig();
      if (!validation.isValid) {
        throw new Error(
          `Invalid configuration: ${validation.errors.join(", ")}`
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to import configuration: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get configuration schema for documentation
   */
  getConfigurationSchema(): any {
    return {
      type: "object",
      title: "Snippet Library Configuration",
      properties: {
        storage: {
          type: "object",
          properties: {
            location: {
              type: "string",
              enum: ["workspace", "global"],
              default: "global",
              description: "Where to store snippets",
            },
            format: {
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
              description: "Backup interval in milliseconds",
            },
            maxBackups: {
              type: "number",
              default: 10,
              description: "Maximum number of backup files to keep",
            },
            path: {
              type: "string",
              description: "Custom storage path (optional)",
            },
          },
        },
        webGUI: {
          type: "object",
          properties: {
            port: {
              type: "number",
              default: 3000,
              minimum: 1024,
              maximum: 65535,
              description: "Port for the web GUI server",
            },
            host: {
              type: "string",
              default: "localhost",
              description: "Host for the web GUI server",
            },
            autoStart: {
              type: "boolean",
              default: false,
              description:
                "Automatically start web GUI on extension activation",
            },
            autoShutdown: {
              type: "boolean",
              default: true,
              description: "Automatically shutdown web GUI when VS Code closes",
            },
            openInBrowser: {
              type: "boolean",
              default: true,
              description: "Automatically open web GUI in browser",
            },
            theme: {
              type: "string",
              enum: ["auto", "light", "dark"],
              default: "auto",
              description: "Web GUI theme preference",
            },
          },
        },
        keybindings: {
          type: "object",
          properties: {
            saveSnippet: {
              type: "string",
              default: "ctrl+shift+s",
              description: "Keybinding for saving snippets",
            },
            insertSnippet: {
              type: "string",
              default: "ctrl+shift+i",
              description: "Keybinding for inserting snippets",
            },
            manageSnippets: {
              type: "string",
              default: "ctrl+shift+m",
              description: "Keybinding for managing snippets",
            },
            openWebGUI: {
              type: "string",
              default: "ctrl+shift+w",
              description: "Keybinding for opening web GUI",
            },
            quickSearch: {
              type: "string",
              default: "ctrl+shift+f",
              description: "Keybinding for quick search",
            },
          },
        },
        editor: {
          type: "object",
          properties: {
            enableIntelliSense: {
              type: "boolean",
              default: true,
              description: "Enable snippet suggestions in IntelliSense",
            },
            enableAutoComplete: {
              type: "boolean",
              default: true,
              description: "Enable automatic snippet completion",
            },
            showPreview: {
              type: "boolean",
              default: true,
              description: "Show snippet preview in completion items",
            },
            insertMode: {
              type: "string",
              enum: ["replace", "insert"],
              default: "insert",
              description: "How to insert snippets when text is selected",
            },
          },
        },
        search: {
          type: "object",
          properties: {
            fuzzySearch: {
              type: "boolean",
              default: true,
              description: "Enable fuzzy search matching",
            },
            caseSensitive: {
              type: "boolean",
              default: false,
              description: "Case sensitive search by default",
            },
            maxResults: {
              type: "number",
              default: 50,
              minimum: 10,
              maximum: 500,
              description: "Maximum number of search results",
            },
            searchHistory: {
              type: "boolean",
              default: true,
              description: "Remember search history",
            },
          },
        },
        notifications: {
          type: "object",
          properties: {
            showSaveConfirmation: {
              type: "boolean",
              default: true,
              description: "Show confirmation when snippet is saved",
            },
            showImportSummary: {
              type: "boolean",
              default: true,
              description: "Show summary after importing snippets",
            },
            showBackupNotifications: {
              type: "boolean",
              default: false,
              description: "Show notifications when backups are created",
            },
          },
        },
      },
    };
  }
}
