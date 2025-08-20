import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as vscode from "vscode";
import { ConfigurationManager } from "../ConfigurationManager";
import {
  StorageConfigInterface,
  WebGUIConfig,
  KeybindingConfig,
  EditorConfig,
  SearchConfig,
  NotificationConfig,
} from "../../types";

// Mock VS Code API
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
    onDidChangeConfiguration: vi.fn(),
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
}));

describe("ConfigurationManager", () => {
  let configManager: ConfigurationManager;
  let mockConfig: any;
  let mockConfigurationChangeEvent: any;

  beforeEach(() => {
    mockConfig = {
      get: vi.fn(),
      update: vi.fn(),
    };

    mockConfigurationChangeEvent = {
      affectsConfiguration: vi.fn(),
    };

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig);
    vi.mocked(vscode.workspace.onDidChangeConfiguration).mockReturnValue({
      dispose: vi.fn(),
    });

    configManager = new ConfigurationManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getStorageConfig", () => {
    it("should return default storage configuration", () => {
      mockConfig.get
        .mockReturnValueOnce("global") // storageLocation
        .mockReturnValueOnce("json") // storageFormat
        .mockReturnValueOnce(true) // autoBackup
        .mockReturnValueOnce(86400000) // backupInterval
        .mockReturnValueOnce(10) // maxBackups
        .mockReturnValueOnce(undefined); // customStoragePath

      const config = configManager.getStorageConfig();

      expect(config).toEqual({
        location: "global",
        format: "json",
        autoBackup: true,
        backupInterval: 86400000,
        maxBackups: 10,
        path: undefined,
      });
    });

    it("should return custom storage configuration", () => {
      mockConfig.get
        .mockReturnValueOnce("workspace") // storageLocation
        .mockReturnValueOnce("yaml") // storageFormat
        .mockReturnValueOnce(false) // autoBackup
        .mockReturnValueOnce(3600000) // backupInterval
        .mockReturnValueOnce(5) // maxBackups
        .mockReturnValueOnce("/custom/path"); // customStoragePath

      const config = configManager.getStorageConfig();

      expect(config).toEqual({
        location: "workspace",
        format: "yaml",
        autoBackup: false,
        backupInterval: 3600000,
        maxBackups: 5,
        path: "/custom/path",
      });
    });
  });

  describe("getWebGUIConfig", () => {
    it("should return default web GUI configuration", () => {
      mockConfig.get
        .mockReturnValueOnce({}) // webGUI object (empty)
        .mockReturnValueOnce(3000) // fallback webGUIPort
        .mockReturnValueOnce("localhost") // fallback webGUIHost
        .mockReturnValueOnce(false) // fallback webGUIAutoStart
        .mockReturnValueOnce(true) // fallback webGUIAutoShutdown
        .mockReturnValueOnce(true); // fallback webGUIOpenInBrowser

      const config = configManager.getWebGUIConfig();

      expect(config).toEqual({
        port: 3000,
        host: "localhost",
        autoStart: false,
        autoShutdown: true,
        openInBrowser: true,
        theme: "auto",
      });
    });

    it("should return web GUI configuration from new format", () => {
      mockConfig.get.mockReturnValueOnce({
        port: 4000,
        host: "0.0.0.0",
        autoStart: true,
        autoShutdown: false,
        openInBrowser: false,
        theme: "dark",
      });

      const config = configManager.getWebGUIConfig();

      expect(config).toEqual({
        port: 4000,
        host: "0.0.0.0",
        autoStart: true,
        autoShutdown: false,
        openInBrowser: false,
        theme: "dark",
      });
    });
  });

  describe("getKeybindingConfig", () => {
    it("should return default keybinding configuration", () => {
      mockConfig.get.mockReturnValueOnce({});

      const config = configManager.getKeybindingConfig();

      expect(config).toEqual({
        saveSnippet: "ctrl+shift+s",
        insertSnippet: "ctrl+shift+i",
        manageSnippets: "ctrl+shift+m",
        openWebGUI: "ctrl+shift+w",
        quickSearch: "ctrl+shift+f",
      });
    });

    it("should return custom keybinding configuration", () => {
      mockConfig.get.mockReturnValueOnce({
        saveSnippet: "ctrl+alt+s",
        insertSnippet: "ctrl+alt+i",
        manageSnippets: "ctrl+alt+m",
        openWebGUI: "ctrl+alt+w",
        quickSearch: "ctrl+alt+f",
      });

      const config = configManager.getKeybindingConfig();

      expect(config).toEqual({
        saveSnippet: "ctrl+alt+s",
        insertSnippet: "ctrl+alt+i",
        manageSnippets: "ctrl+alt+m",
        openWebGUI: "ctrl+alt+w",
        quickSearch: "ctrl+alt+f",
      });
    });
  });

  describe("getEditorConfig", () => {
    it("should return default editor configuration", () => {
      mockConfig.get.mockReturnValueOnce({});

      const config = configManager.getEditorConfig();

      expect(config).toEqual({
        enableIntelliSense: true,
        enableAutoComplete: true,
        showPreview: true,
        insertMode: "insert",
      });
    });

    it("should return custom editor configuration", () => {
      mockConfig.get.mockReturnValueOnce({
        enableIntelliSense: false,
        enableAutoComplete: false,
        showPreview: false,
        insertMode: "replace",
      });

      const config = configManager.getEditorConfig();

      expect(config).toEqual({
        enableIntelliSense: false,
        enableAutoComplete: false,
        showPreview: false,
        insertMode: "replace",
      });
    });
  });

  describe("getSearchConfig", () => {
    it("should return default search configuration", () => {
      mockConfig.get.mockReturnValueOnce({});

      const config = configManager.getSearchConfig();

      expect(config).toEqual({
        fuzzySearch: true,
        caseSensitive: false,
        maxResults: 50,
        searchHistory: true,
      });
    });

    it("should return custom search configuration", () => {
      mockConfig.get.mockReturnValueOnce({
        fuzzySearch: false,
        caseSensitive: true,
        maxResults: 100,
        searchHistory: false,
      });

      const config = configManager.getSearchConfig();

      expect(config).toEqual({
        fuzzySearch: false,
        caseSensitive: true,
        maxResults: 100,
        searchHistory: false,
      });
    });
  });

  describe("getNotificationConfig", () => {
    it("should return default notification configuration", () => {
      mockConfig.get.mockReturnValueOnce({});

      const config = configManager.getNotificationConfig();

      expect(config).toEqual({
        showSaveConfirmation: true,
        showImportSummary: true,
        showBackupNotifications: false,
      });
    });

    it("should return custom notification configuration", () => {
      mockConfig.get.mockReturnValueOnce({
        showSaveConfirmation: false,
        showImportSummary: false,
        showBackupNotifications: true,
      });

      const config = configManager.getNotificationConfig();

      expect(config).toEqual({
        showSaveConfirmation: false,
        showImportSummary: false,
        showBackupNotifications: true,
      });
    });
  });

  describe("getExtensionConfig", () => {
    it("should return complete extension configuration", () => {
      // Mock all the individual config getters
      mockConfig.get
        .mockReturnValueOnce("global") // storage.location
        .mockReturnValueOnce("json") // storage.format
        .mockReturnValueOnce(true) // storage.autoBackup
        .mockReturnValueOnce(86400000) // storage.backupInterval
        .mockReturnValueOnce(10) // storage.maxBackups
        .mockReturnValueOnce(undefined) // storage.path
        .mockReturnValueOnce({}) // webGUI (empty)
        .mockReturnValueOnce(3000) // webGUI fallbacks...
        .mockReturnValueOnce("localhost")
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce({}) // keybindings
        .mockReturnValueOnce({}) // editor
        .mockReturnValueOnce({}) // search
        .mockReturnValueOnce({}); // notifications

      const config = configManager.getExtensionConfig();

      expect(config).toHaveProperty("storage");
      expect(config).toHaveProperty("webGUI");
      expect(config).toHaveProperty("keybindings");
      expect(config).toHaveProperty("editor");
      expect(config).toHaveProperty("search");
      expect(config).toHaveProperty("notifications");
    });
  });

  describe("updateStorageConfig", () => {
    it("should update storage configuration", async () => {
      const updates: Partial<StorageConfigInterface> = {
        location: "workspace",
        format: "yaml",
        autoBackup: false,
      };

      await configManager.updateStorageConfig(updates);

      expect(mockConfig.update).toHaveBeenCalledWith(
        "storageLocation",
        "workspace",
        vscode.ConfigurationTarget.Global
      );
      expect(mockConfig.update).toHaveBeenCalledWith(
        "storageFormat",
        "yaml",
        vscode.ConfigurationTarget.Global
      );
      expect(mockConfig.update).toHaveBeenCalledWith(
        "autoBackup",
        false,
        vscode.ConfigurationTarget.Global
      );
    });
  });

  describe("updateWebGUIConfig", () => {
    it("should update web GUI configuration", async () => {
      // Mock getWebGUIConfig method to return current config
      vi.spyOn(configManager, "getWebGUIConfig").mockReturnValue({
        port: 3000,
        host: "localhost",
        autoStart: false,
        autoShutdown: true,
        openInBrowser: true,
        theme: "auto",
      });

      const updates: Partial<WebGUIConfig> = {
        port: 4000,
        theme: "dark",
      };

      await configManager.updateWebGUIConfig(updates);

      expect(mockConfig.update).toHaveBeenCalledWith(
        "webGUI",
        {
          port: 4000,
          host: "localhost",
          autoStart: false,
          autoShutdown: true,
          openInBrowser: true,
          theme: "dark",
        },
        vscode.ConfigurationTarget.Global
      );
    });
  });

  describe("validateConfig", () => {
    beforeEach(() => {
      // Mock a valid configuration for validation tests
      vi.spyOn(configManager, "getExtensionConfig").mockReturnValue({
        storage: {
          location: "global",
          format: "json",
          autoBackup: true,
          backupInterval: 86400000,
          maxBackups: 10,
        },
        webGUI: {
          port: 3000,
          host: "localhost",
          autoStart: false,
          autoShutdown: true,
          openInBrowser: true,
          theme: "auto",
        },
        keybindings: {
          saveSnippet: "ctrl+shift+s",
          insertSnippet: "ctrl+shift+i",
          manageSnippets: "ctrl+shift+m",
          openWebGUI: "ctrl+shift+w",
          quickSearch: "ctrl+shift+f",
        },
        editor: {
          enableIntelliSense: true,
          enableAutoComplete: true,
          showPreview: true,
          insertMode: "insert",
        },
        search: {
          fuzzySearch: true,
          caseSensitive: false,
          maxResults: 50,
          searchHistory: true,
        },
        notifications: {
          showSaveConfirmation: true,
          showImportSummary: true,
          showBackupNotifications: false,
        },
      });
    });

    it("should validate correct configuration", () => {
      const result = configManager.validateConfig();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid backup interval", () => {
      // Override the mock to return invalid backup interval
      vi.spyOn(configManager, "getExtensionConfig").mockReturnValue({
        storage: {
          location: "global",
          format: "json",
          autoBackup: true,
          backupInterval: 100000, // Less than 5 minutes
          maxBackups: 10,
        },
        webGUI: {
          port: 3000,
          host: "localhost",
          autoStart: false,
          autoShutdown: true,
          openInBrowser: true,
          theme: "auto",
        },
        keybindings: {
          saveSnippet: "ctrl+shift+s",
          insertSnippet: "ctrl+shift+i",
          manageSnippets: "ctrl+shift+m",
          openWebGUI: "ctrl+shift+w",
          quickSearch: "ctrl+shift+f",
        },
        editor: {
          enableIntelliSense: true,
          enableAutoComplete: true,
          showPreview: true,
          insertMode: "insert",
        },
        search: {
          fuzzySearch: true,
          caseSensitive: false,
          maxResults: 50,
          searchHistory: true,
        },
        notifications: {
          showSaveConfirmation: true,
          showImportSummary: true,
          showBackupNotifications: false,
        },
      });

      const result = configManager.validateConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Invalid backup interval. Must be at least 5 minutes (300000ms)."
      );
    });

    it("should detect invalid web GUI port", () => {
      vi.spyOn(configManager, "getExtensionConfig").mockReturnValue({
        storage: {
          location: "global",
          format: "json",
          autoBackup: true,
          backupInterval: 86400000,
          maxBackups: 10,
        },
        webGUI: {
          port: 70000, // Invalid port
          host: "localhost",
          autoStart: false,
          autoShutdown: true,
          openInBrowser: true,
          theme: "auto",
        },
        keybindings: {
          saveSnippet: "ctrl+shift+s",
          insertSnippet: "ctrl+shift+i",
          manageSnippets: "ctrl+shift+m",
          openWebGUI: "ctrl+shift+w",
          quickSearch: "ctrl+shift+f",
        },
        editor: {
          enableIntelliSense: true,
          enableAutoComplete: true,
          showPreview: true,
          insertMode: "insert",
        },
        search: {
          fuzzySearch: true,
          caseSensitive: false,
          maxResults: 50,
          searchHistory: true,
        },
        notifications: {
          showSaveConfirmation: true,
          showImportSummary: true,
          showBackupNotifications: false,
        },
      });

      const result = configManager.validateConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Invalid web GUI port. Must be between 1024 and 65535."
      );
    });
  });

  describe("onConfigurationChanged", () => {
    it("should register configuration change listener", () => {
      const callback = vi.fn();
      const disposable = { dispose: vi.fn() };
      vi.mocked(vscode.workspace.onDidChangeConfiguration).mockReturnValue(
        disposable
      );

      const result = configManager.onConfigurationChanged(callback);

      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
      expect(result).toBe(disposable);
    });
  });

  describe("hasConfigurationChanged", () => {
    it("should check if specific configuration key has changed", () => {
      mockConfigurationChangeEvent.affectsConfiguration.mockReturnValue(true);

      const result = configManager.hasConfigurationChanged(
        mockConfigurationChangeEvent,
        "storageLocation"
      );

      expect(result).toBe(true);
      expect(
        mockConfigurationChangeEvent.affectsConfiguration
      ).toHaveBeenCalledWith("snippetLibrary.storageLocation");
    });
  });

  describe("migrateConfiguration", () => {
    it("should migrate old configuration format", async () => {
      mockConfig.get
        .mockReturnValueOnce(4000) // old webGUIPort
        .mockReturnValueOnce("0.0.0.0") // old webGUIHost
        .mockReturnValueOnce(true) // old webGUIAutoStart
        .mockReturnValueOnce(false) // old webGUIAutoShutdown
        .mockReturnValueOnce(false); // old webGUIOpenInBrowser

      await configManager.migrateConfiguration();

      expect(mockConfig.update).toHaveBeenCalledWith(
        "webGUI",
        {
          port: 4000,
          host: "0.0.0.0",
          autoStart: true,
          autoShutdown: false,
          openInBrowser: false,
          theme: "auto",
        },
        vscode.ConfigurationTarget.Global
      );

      // Should remove old keys
      expect(mockConfig.update).toHaveBeenCalledWith(
        "webGUIPort",
        undefined,
        vscode.ConfigurationTarget.Global
      );
    });

    it("should not migrate if no old configuration exists", async () => {
      mockConfig.get.mockReturnValue(undefined);

      await configManager.migrateConfiguration();

      expect(mockConfig.update).not.toHaveBeenCalled();
    });
  });

  describe("exportConfiguration", () => {
    it("should export configuration as JSON", () => {
      // Mock the getExtensionConfig method
      vi.spyOn(configManager, "getExtensionConfig").mockReturnValue({
        storage: {
          location: "global",
          format: "json",
          autoBackup: true,
          backupInterval: 86400000,
          maxBackups: 10,
        },
        webGUI: {
          port: 3000,
          host: "localhost",
          autoStart: false,
          autoShutdown: true,
          openInBrowser: true,
          theme: "auto",
        },
        keybindings: {
          saveSnippet: "ctrl+shift+s",
          insertSnippet: "ctrl+shift+i",
          manageSnippets: "ctrl+shift+m",
          openWebGUI: "ctrl+shift+w",
          quickSearch: "ctrl+shift+f",
        },
        editor: {
          enableIntelliSense: true,
          enableAutoComplete: true,
          showPreview: true,
          insertMode: "insert",
        },
        search: {
          fuzzySearch: true,
          caseSensitive: false,
          maxResults: 50,
          searchHistory: true,
        },
        notifications: {
          showSaveConfirmation: true,
          showImportSummary: true,
          showBackupNotifications: false,
        },
      });

      const exported = configManager.exportConfiguration();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty("storage");
      expect(parsed).toHaveProperty("webGUI");
      expect(parsed).toHaveProperty("keybindings");
      expect(parsed).toHaveProperty("editor");
      expect(parsed).toHaveProperty("search");
      expect(parsed).toHaveProperty("notifications");
    });
  });

  describe("importConfiguration", () => {
    it("should import valid configuration", async () => {
      const configJson = JSON.stringify({
        storage: {
          location: "workspace",
          format: "yaml",
          autoBackup: false,
          backupInterval: 43200000,
          maxBackups: 5,
        },
        webGUI: {
          port: 4000,
          host: "0.0.0.0",
          autoStart: true,
          autoShutdown: false,
          openInBrowser: false,
          theme: "dark",
        },
        keybindings: {
          saveSnippet: "ctrl+alt+s",
          insertSnippet: "ctrl+alt+i",
          manageSnippets: "ctrl+alt+m",
          openWebGUI: "ctrl+alt+w",
          quickSearch: "ctrl+alt+f",
        },
        editor: {
          enableIntelliSense: false,
          enableAutoComplete: false,
          showPreview: false,
          insertMode: "replace",
        },
        search: {
          fuzzySearch: false,
          caseSensitive: true,
          maxResults: 100,
          searchHistory: false,
        },
        notifications: {
          showSaveConfirmation: false,
          showImportSummary: false,
          showBackupNotifications: true,
        },
      });

      // Mock individual config getters to return current values
      vi.spyOn(configManager, "getStorageConfig").mockReturnValue({
        location: "global",
        format: "json",
        autoBackup: true,
        backupInterval: 86400000,
        maxBackups: 10,
      });
      vi.spyOn(configManager, "getWebGUIConfig").mockReturnValue({
        port: 3000,
        host: "localhost",
        autoStart: false,
        autoShutdown: true,
        openInBrowser: true,
        theme: "auto",
      });
      vi.spyOn(configManager, "getKeybindingConfig").mockReturnValue({
        saveSnippet: "ctrl+shift+s",
        insertSnippet: "ctrl+shift+i",
        manageSnippets: "ctrl+shift+m",
        openWebGUI: "ctrl+shift+w",
        quickSearch: "ctrl+shift+f",
      });
      vi.spyOn(configManager, "getEditorConfig").mockReturnValue({
        enableIntelliSense: true,
        enableAutoComplete: true,
        showPreview: true,
        insertMode: "insert",
      });
      vi.spyOn(configManager, "getSearchConfig").mockReturnValue({
        fuzzySearch: true,
        caseSensitive: false,
        maxResults: 50,
        searchHistory: true,
      });
      vi.spyOn(configManager, "getNotificationConfig").mockReturnValue({
        showSaveConfirmation: true,
        showImportSummary: true,
        showBackupNotifications: false,
      });

      // Mock validation to pass
      vi.spyOn(configManager, "validateConfig").mockReturnValue({
        isValid: true,
        errors: [],
      });

      await configManager.importConfiguration(configJson);

      expect(mockConfig.update).toHaveBeenCalledTimes(10); // Storage config calls individual updates
    });

    it("should throw error for invalid JSON", async () => {
      const invalidJson = "{ invalid json }";

      await expect(
        configManager.importConfiguration(invalidJson)
      ).rejects.toThrow("Failed to import configuration:");
    });

    it("should throw error for invalid configuration", async () => {
      const configJson = JSON.stringify({
        storage: { location: "invalid" },
      });

      // Mock individual config getters to return current values (needed for update methods)
      vi.spyOn(configManager, "getStorageConfig").mockReturnValue({
        location: "global",
        format: "json",
        autoBackup: true,
        backupInterval: 86400000,
        maxBackups: 10,
      });
      vi.spyOn(configManager, "getWebGUIConfig").mockReturnValue({
        port: 3000,
        host: "localhost",
        autoStart: false,
        autoShutdown: true,
        openInBrowser: true,
        theme: "auto",
      });
      vi.spyOn(configManager, "getKeybindingConfig").mockReturnValue({
        saveSnippet: "ctrl+shift+s",
        insertSnippet: "ctrl+shift+i",
        manageSnippets: "ctrl+shift+m",
        openWebGUI: "ctrl+shift+w",
        quickSearch: "ctrl+shift+f",
      });
      vi.spyOn(configManager, "getEditorConfig").mockReturnValue({
        enableIntelliSense: true,
        enableAutoComplete: true,
        showPreview: true,
        insertMode: "insert",
      });
      vi.spyOn(configManager, "getSearchConfig").mockReturnValue({
        fuzzySearch: true,
        caseSensitive: false,
        maxResults: 50,
        searchHistory: true,
      });
      vi.spyOn(configManager, "getNotificationConfig").mockReturnValue({
        showSaveConfirmation: true,
        showImportSummary: true,
        showBackupNotifications: false,
      });

      // Mock validation to fail
      vi.spyOn(configManager, "validateConfig").mockReturnValue({
        isValid: false,
        errors: ["Invalid storage location"],
      });

      await expect(
        configManager.importConfiguration(configJson)
      ).rejects.toThrow("Invalid configuration: Invalid storage location");
    });
  });

  describe("resetToDefaults", () => {
    it("should reset all configuration to defaults", async () => {
      await configManager.resetToDefaults();

      expect(mockConfig.update).toHaveBeenCalledTimes(11); // All default settings
      expect(mockConfig.update).toHaveBeenCalledWith(
        "storageLocation",
        "global",
        vscode.ConfigurationTarget.Global
      );
      expect(mockConfig.update).toHaveBeenCalledWith(
        "storageFormat",
        "json",
        vscode.ConfigurationTarget.Global
      );
    });
  });
});
