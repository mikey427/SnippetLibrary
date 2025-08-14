import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as vscode from "vscode";
import { ConfigurationManager } from "../ConfigurationManager";

// Mock VS Code API
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
  },
}));

describe("ConfigurationManager", () => {
  let configManager: ConfigurationManager;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      get: vi.fn(),
      update: vi.fn(),
    };

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig);
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
        .mockReturnValueOnce(undefined); // customStoragePath

      const config = configManager.getStorageConfig();

      expect(config).toEqual({
        location: "global",
        format: "json",
        autoBackup: true,
        backupInterval: 86400000,
        path: undefined,
      });
    });

    it("should return custom storage configuration", () => {
      mockConfig.get
        .mockReturnValueOnce("workspace") // storageLocation
        .mockReturnValueOnce("yaml") // storageFormat
        .mockReturnValueOnce(false) // autoBackup
        .mockReturnValueOnce(3600000) // backupInterval
        .mockReturnValueOnce("/custom/path"); // customStoragePath

      const config = configManager.getStorageConfig();

      expect(config).toEqual({
        location: "workspace",
        format: "yaml",
        autoBackup: false,
        backupInterval: 3600000,
        path: "/custom/path",
      });
    });
  });

  describe("individual getters", () => {
    it("should get storage location", () => {
      mockConfig.get.mockReturnValue("workspace");

      const location = configManager.getStorageLocation();

      expect(location).toBe("workspace");
      expect(mockConfig.get).toHaveBeenCalledWith("storageLocation", "global");
    });

    it("should get storage format", () => {
      mockConfig.get.mockReturnValue("yaml");

      const format = configManager.getStorageFormat();

      expect(format).toBe("yaml");
      expect(mockConfig.get).toHaveBeenCalledWith("storageFormat", "json");
    });

    it("should get auto backup setting", () => {
      mockConfig.get.mockReturnValue(false);

      const autoBackup = configManager.getAutoBackup();

      expect(autoBackup).toBe(false);
      expect(mockConfig.get).toHaveBeenCalledWith("autoBackup", true);
    });

    it("should get backup interval", () => {
      mockConfig.get.mockReturnValue(3600000);

      const interval = configManager.getBackupInterval();

      expect(interval).toBe(3600000);
      expect(mockConfig.get).toHaveBeenCalledWith("backupInterval", 86400000);
    });

    it("should get custom storage path", () => {
      mockConfig.get.mockReturnValue("/custom/path");

      const path = configManager.getCustomStoragePath();

      expect(path).toBe("/custom/path");
      expect(mockConfig.get).toHaveBeenCalledWith("customStoragePath");
    });

    it("should get web GUI port", () => {
      mockConfig.get.mockReturnValue(8080);

      const port = configManager.getWebGUIPort();

      expect(port).toBe(8080);
      expect(mockConfig.get).toHaveBeenCalledWith("webGUIPort", 3000);
    });

    it("should get web GUI auto launch setting", () => {
      mockConfig.get.mockReturnValue(true);

      const autoLaunch = configManager.getWebGUIAutoLaunch();

      expect(autoLaunch).toBe(true);
      expect(mockConfig.get).toHaveBeenCalledWith("webGUIAutoLaunch", false);
    });
  });

  describe("updateConfig", () => {
    it("should update configuration with default target", async () => {
      await configManager.updateConfig("storageLocation", "workspace");

      expect(mockConfig.update).toHaveBeenCalledWith(
        "storageLocation",
        "workspace",
        vscode.ConfigurationTarget.Global
      );
    });

    it("should update configuration with specified target", async () => {
      await configManager.updateConfig(
        "storageLocation",
        "workspace",
        vscode.ConfigurationTarget.Workspace
      );

      expect(mockConfig.update).toHaveBeenCalledWith(
        "storageLocation",
        "workspace",
        vscode.ConfigurationTarget.Workspace
      );
    });
  });

  describe("resetToDefaults", () => {
    it("should reset all settings to defaults", async () => {
      await configManager.resetToDefaults();

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
      expect(mockConfig.update).toHaveBeenCalledWith(
        "autoBackup",
        true,
        vscode.ConfigurationTarget.Global
      );
      expect(mockConfig.update).toHaveBeenCalledWith(
        "backupInterval",
        86400000,
        vscode.ConfigurationTarget.Global
      );
      expect(mockConfig.update).toHaveBeenCalledWith(
        "webGUIPort",
        3000,
        vscode.ConfigurationTarget.Global
      );
      expect(mockConfig.update).toHaveBeenCalledWith(
        "webGUIAutoLaunch",
        false,
        vscode.ConfigurationTarget.Global
      );
    });
  });

  describe("getAllConfig", () => {
    it("should return all configuration values", () => {
      mockConfig.get
        .mockReturnValueOnce("workspace") // storageLocation
        .mockReturnValueOnce("yaml") // storageFormat
        .mockReturnValueOnce(false) // autoBackup
        .mockReturnValueOnce(3600000) // backupInterval
        .mockReturnValueOnce("/custom") // customStoragePath
        .mockReturnValueOnce(8080) // webGUIPort
        .mockReturnValueOnce(true); // webGUIAutoLaunch

      const allConfig = configManager.getAllConfig();

      expect(allConfig).toEqual({
        storageLocation: "workspace",
        storageFormat: "yaml",
        autoBackup: false,
        backupInterval: 3600000,
        customStoragePath: "/custom",
        webGUIPort: 8080,
        webGUIAutoLaunch: true,
      });
    });
  });

  describe("validateConfig", () => {
    it("should validate valid configuration", () => {
      mockConfig.get
        .mockReturnValueOnce("global") // storageLocation
        .mockReturnValueOnce("json") // storageFormat
        .mockReturnValueOnce(true) // autoBackup
        .mockReturnValueOnce(86400000) // backupInterval
        .mockReturnValueOnce(undefined) // customStoragePath
        .mockReturnValueOnce(3000) // webGUIPort
        .mockReturnValueOnce(false); // webGUIAutoLaunch

      const validation = configManager.validateConfig();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it("should detect invalid storage location", () => {
      mockConfig.get
        .mockReturnValueOnce("invalid") // storageLocation
        .mockReturnValueOnce("json") // storageFormat
        .mockReturnValueOnce(true) // autoBackup
        .mockReturnValueOnce(86400000) // backupInterval
        .mockReturnValueOnce(undefined) // customStoragePath
        .mockReturnValueOnce(3000) // webGUIPort
        .mockReturnValueOnce(false); // webGUIAutoLaunch

      const validation = configManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Invalid storage location. Must be 'workspace' or 'global'."
      );
    });

    it("should detect invalid storage format", () => {
      mockConfig.get
        .mockReturnValueOnce("global") // storageLocation
        .mockReturnValueOnce("xml") // storageFormat
        .mockReturnValueOnce(true) // autoBackup
        .mockReturnValueOnce(86400000) // backupInterval
        .mockReturnValueOnce(undefined) // customStoragePath
        .mockReturnValueOnce(3000) // webGUIPort
        .mockReturnValueOnce(false); // webGUIAutoLaunch

      const validation = configManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Invalid storage format. Must be 'json' or 'yaml'."
      );
    });

    it("should detect invalid backup interval", () => {
      mockConfig.get
        .mockReturnValueOnce("global") // storageLocation
        .mockReturnValueOnce("json") // storageFormat
        .mockReturnValueOnce(true) // autoBackup
        .mockReturnValueOnce(-1000) // backupInterval
        .mockReturnValueOnce(undefined) // customStoragePath
        .mockReturnValueOnce(3000) // webGUIPort
        .mockReturnValueOnce(false); // webGUIAutoLaunch

      const validation = configManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Invalid backup interval. Must be a positive number."
      );
    });

    it("should detect invalid web GUI port", () => {
      mockConfig.get
        .mockReturnValueOnce("global") // storageLocation
        .mockReturnValueOnce("json") // storageFormat
        .mockReturnValueOnce(true) // autoBackup
        .mockReturnValueOnce(86400000) // backupInterval
        .mockReturnValueOnce(undefined) // customStoragePath
        .mockReturnValueOnce(70000) // webGUIPort (too high)
        .mockReturnValueOnce(false); // webGUIAutoLaunch

      const validation = configManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Invalid web GUI port. Must be a number between 1 and 65535."
      );
    });

    it("should detect multiple validation errors", () => {
      mockConfig.get
        .mockReturnValueOnce("invalid") // storageLocation
        .mockReturnValueOnce("xml") // storageFormat
        .mockReturnValueOnce(true) // autoBackup
        .mockReturnValueOnce(-1000) // backupInterval
        .mockReturnValueOnce(undefined) // customStoragePath
        .mockReturnValueOnce(0) // webGUIPort
        .mockReturnValueOnce(false); // webGUIAutoLaunch

      const validation = configManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(4);
    });
  });

  describe("getConfigurationSchema", () => {
    it("should return configuration schema", () => {
      const schema = configManager.getConfigurationSchema();

      expect(schema).toHaveProperty("type", "object");
      expect(schema).toHaveProperty("title", "Snippet Library Configuration");
      expect(schema).toHaveProperty("properties");
      expect(schema.properties).toHaveProperty("storageLocation");
      expect(schema.properties).toHaveProperty("storageFormat");
      expect(schema.properties).toHaveProperty("autoBackup");
      expect(schema.properties).toHaveProperty("backupInterval");
      expect(schema.properties).toHaveProperty("customStoragePath");
      expect(schema.properties).toHaveProperty("webGUIPort");
      expect(schema.properties).toHaveProperty("webGUIAutoLaunch");
    });
  });
});
