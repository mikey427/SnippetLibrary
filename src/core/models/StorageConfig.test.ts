import { describe, it, expect, beforeEach } from "vitest";
import { StorageConfig } from "./StorageConfig";
import { StorageConfigInterface } from "../../types";

describe("StorageConfig", () => {
  describe("constructor", () => {
    it("should create config with default values", () => {
      const config = new StorageConfig();

      expect(config.location).toBe("global");
      expect(config.format).toBe("json");
      expect(config.autoBackup).toBe(true);
      expect(config.backupInterval).toBe(3600000); // 1 hour
      expect(config.path).toBeUndefined();
    });

    it("should create config with provided values", () => {
      const configData: IStorageConfig = {
        location: "workspace",
        path: "/custom/path/snippets.json",
        format: "yaml",
        autoBackup: false,
        backupInterval: 1800000, // 30 minutes
      };

      const config = new StorageConfig(configData);

      expect(config.location).toBe(configData.location);
      expect(config.path).toBe(configData.path);
      expect(config.format).toBe(configData.format);
      expect(config.autoBackup).toBe(configData.autoBackup);
      expect(config.backupInterval).toBe(configData.backupInterval);
    });

    it("should throw error for invalid config", () => {
      const invalidConfig = { location: "invalid" };

      expect(() => new StorageConfig(invalidConfig)).toThrow(
        "Invalid storage config"
      );
    });
  });

  describe("static factory methods", () => {
    describe("createGlobal", () => {
      it("should create global storage config", () => {
        const config = StorageConfig.createGlobal();

        expect(config.location).toBe("global");
        expect(config.format).toBe("json");
        expect(config.autoBackup).toBe(true);
        expect(config.backupInterval).toBe(3600000);
      });
    });

    describe("createWorkspace", () => {
      it("should create workspace storage config", () => {
        const config = StorageConfig.createWorkspace();

        expect(config.location).toBe("workspace");
        expect(config.format).toBe("json");
        expect(config.autoBackup).toBe(true);
        expect(config.backupInterval).toBe(3600000);
      });

      it("should create workspace storage config with path", () => {
        const workspacePath = "/workspace/path";
        const config = StorageConfig.createWorkspace(workspacePath);

        expect(config.location).toBe("workspace");
        expect(config.path).toBe(workspacePath);
      });
    });

    describe("fromVSCodeConfig", () => {
      it("should create config from VS Code settings", () => {
        const vscodeConfig = {
          storageLocation: "workspace",
          storageFormat: "yaml",
          autoBackup: false,
          backupInterval: 1800000,
        };

        const result = StorageConfig.fromVSCodeConfig(vscodeConfig);

        expect(result.success).toBe(true);
        expect(result.data?.location).toBe("workspace");
        expect(result.data?.format).toBe("yaml");
        expect(result.data?.autoBackup).toBe(false);
        expect(result.data?.backupInterval).toBe(1800000);
      });

      it("should use defaults for missing values", () => {
        const vscodeConfig = {};

        const result = StorageConfig.fromVSCodeConfig(vscodeConfig);

        expect(result.success).toBe(true);
        expect(result.data?.location).toBe("global");
        expect(result.data?.format).toBe("json");
        expect(result.data?.autoBackup).toBe(true);
      });

      it("should return error for invalid VS Code config", () => {
        const invalidConfig = { storageLocation: "invalid" };

        const result = StorageConfig.fromVSCodeConfig(invalidConfig);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain(
          "Failed to create storage config"
        );
      });
    });
  });

  describe("validate", () => {
    it("should return success for valid config", () => {
      const validConfig = {
        location: "global",
        format: "json",
        autoBackup: true,
        backupInterval: 3600000,
      };

      const result = StorageConfig.validate(validConfig);

      expect(result.success).toBe(true);
    });

    it("should return error for non-object config", () => {
      const result = StorageConfig.validate("invalid");

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("must be an object");
    });

    it("should return error for invalid location", () => {
      const invalidConfig = { location: "invalid" };

      const result = StorageConfig.validate(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(
        "Storage location must be one of"
      );
    });

    it("should return error for invalid path", () => {
      const invalidConfig = { path: "" };

      const result = StorageConfig.validate(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("non-empty string");
    });

    it("should return error for non-absolute global path", () => {
      const invalidConfig = {
        location: "global",
        path: "relative/path",
      };

      const result = StorageConfig.validate(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(
        "Global storage path must be absolute"
      );
    });

    it("should return error for invalid format", () => {
      const invalidConfig = { format: "xml" };

      const result = StorageConfig.validate(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Storage format must be one of");
    });

    it("should return error for invalid autoBackup", () => {
      const invalidConfig = { autoBackup: "yes" };

      const result = StorageConfig.validate(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("must be a boolean");
    });

    it("should return error for invalid backupInterval", () => {
      const invalidConfig = { backupInterval: 30000 }; // Less than 1 minute

      const result = StorageConfig.validate(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("must be a number >= 60000");
    });

    it("should return error for non-numeric backupInterval", () => {
      const invalidConfig = { backupInterval: "invalid" };

      const result = StorageConfig.validate(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("must be a number >= 60000");
    });
  });

  describe("instance validate", () => {
    it("should validate current config", () => {
      const config = new StorageConfig();
      const result = config.validate();

      expect(result.success).toBe(true);
    });
  });

  describe("update", () => {
    let config: StorageConfig;

    beforeEach(() => {
      config = new StorageConfig();
    });

    it("should update config with valid data", () => {
      const updates = {
        location: "workspace" as const,
        format: "yaml" as const,
        autoBackup: false,
      };

      const result = config.update(updates);

      expect(result.success).toBe(true);
      expect(config.location).toBe(updates.location);
      expect(config.format).toBe(updates.format);
      expect(config.autoBackup).toBe(updates.autoBackup);
    });

    it("should reject invalid updates", () => {
      const invalidUpdates = { location: "invalid" as any };

      const result = config.update(invalidUpdates);

      expect(result.success).toBe(false);
      expect(config.location).toBe("global"); // Should remain unchanged
    });

    it("should handle partial updates", () => {
      const originalLocation = config.location;
      const updates = { format: "yaml" as const };

      const result = config.update(updates);

      expect(result.success).toBe(true);
      expect(config.location).toBe(originalLocation); // Should remain unchanged
      expect(config.format).toBe(updates.format);
    });
  });

  describe("file methods", () => {
    describe("getFileExtension", () => {
      it("should return .json for json format", () => {
        const config = new StorageConfig({ format: "json" });

        expect(config.getFileExtension()).toBe(".json");
      });

      it("should return .yaml for yaml format", () => {
        const config = new StorageConfig({ format: "yaml" });

        expect(config.getFileExtension()).toBe(".yaml");
      });
    });

    describe("getSnippetsFilename", () => {
      it("should return snippets.json for json format", () => {
        const config = new StorageConfig({ format: "json" });

        expect(config.getSnippetsFilename()).toBe("snippets.json");
      });

      it("should return snippets.yaml for yaml format", () => {
        const config = new StorageConfig({ format: "yaml" });

        expect(config.getSnippetsFilename()).toBe("snippets.yaml");
      });
    });

    describe("getBackupFilename", () => {
      it("should return backup filename with timestamp", () => {
        const config = new StorageConfig({ format: "json" });
        const timestamp = new Date("2023-01-01T12:00:00.000Z");

        const filename = config.getBackupFilename(timestamp);

        expect(filename).toMatch(
          /^snippets-backup-2023-01-01T12-00-00-000Z\.json$/
        );
      });

      it("should use current time if no timestamp provided", () => {
        const config = new StorageConfig({ format: "json" });

        const filename = config.getBackupFilename();

        expect(filename).toMatch(/^snippets-backup-.*\.json$/);
      });
    });
  });

  describe("backup methods", () => {
    describe("isBackupDue", () => {
      it("should return false if autoBackup is disabled", () => {
        const config = new StorageConfig({ autoBackup: false });
        const lastBackup = new Date(Date.now() - 7200000); // 2 hours ago

        expect(config.isBackupDue(lastBackup)).toBe(false);
      });

      it("should return true if backup interval has passed", () => {
        const config = new StorageConfig({
          autoBackup: true,
          backupInterval: 3600000, // 1 hour
        });
        const lastBackup = new Date(Date.now() - 7200000); // 2 hours ago

        expect(config.isBackupDue(lastBackup)).toBe(true);
      });

      it("should return false if backup interval has not passed", () => {
        const config = new StorageConfig({
          autoBackup: true,
          backupInterval: 3600000, // 1 hour
        });
        const lastBackup = new Date(Date.now() - 1800000); // 30 minutes ago

        expect(config.isBackupDue(lastBackup)).toBe(false);
      });
    });
  });

  describe("path methods", () => {
    describe("getStorageDirectory", () => {
      it("should return custom path directory if path is set", () => {
        const config = new StorageConfig({
          path: "/custom/path/snippets.json",
        });

        expect(config.getStorageDirectory()).toBe("/custom/path");
      });

      it("should return workspace directory for workspace location", () => {
        const config = new StorageConfig({ location: "workspace" });

        expect(config.getStorageDirectory()).toBe(".vscode/snippets");
      });

      it("should return global directory for global location", () => {
        const config = new StorageConfig({ location: "global" });

        expect(config.getStorageDirectory()).toBe(
          "~/.vscode/extensions/snippet-library"
        );
      });
    });

    describe("getStorageFilePath", () => {
      it("should return custom path if set", () => {
        const customPath = "/custom/path/snippets.json";
        const config = new StorageConfig({ path: customPath });

        expect(config.getStorageFilePath()).toBe(customPath);
      });

      it("should construct path from directory and filename", () => {
        const config = new StorageConfig({
          location: "workspace",
          format: "yaml",
        });

        const filePath = config.getStorageFilePath();

        expect(filePath).toMatch(/\.vscode[/\\]snippets[/\\]snippets\.yaml$/);
      });
    });
  });

  describe("utility methods", () => {
    describe("clone", () => {
      it("should create independent copy", () => {
        const original = new StorageConfig({
          location: "workspace",
          format: "yaml",
          autoBackup: false,
        });

        const clone = original.clone();

        // Modify clone
        clone.location = "global";
        clone.format = "json";

        // Original should be unchanged
        expect(original.location).toBe("workspace");
        expect(original.format).toBe("yaml");
      });
    });

    describe("toPlainObject", () => {
      it("should convert to plain object", () => {
        const configData: IStorageConfig = {
          location: "workspace",
          path: "/custom/path",
          format: "yaml",
          autoBackup: false,
          backupInterval: 1800000,
        };

        const config = new StorageConfig(configData);
        const plain = config.toPlainObject();

        expect(plain).toEqual(configData);
      });
    });

    describe("toJSON", () => {
      it("should convert to JSON format", () => {
        const config = new StorageConfig({
          location: "workspace",
          format: "yaml",
        });

        const json = config.toJSON();

        expect(json.location).toBe("workspace");
        expect(json.format).toBe("yaml");
      });
    });

    describe("equals", () => {
      it("should return true for identical configs", () => {
        const config1 = new StorageConfig({
          location: "workspace",
          format: "yaml",
          autoBackup: false,
        });

        const config2 = new StorageConfig({
          location: "workspace",
          format: "yaml",
          autoBackup: false,
        });

        expect(config1.equals(config2)).toBe(true);
      });

      it("should return false for different configs", () => {
        const config1 = new StorageConfig({ location: "workspace" });
        const config2 = new StorageConfig({ location: "global" });

        expect(config1.equals(config2)).toBe(false);
      });

      it("should handle undefined path values", () => {
        const config1 = new StorageConfig({ location: "workspace" });
        const config2 = new StorageConfig({
          location: "workspace",
          path: undefined,
        });

        expect(config1.equals(config2)).toBe(true);
      });
    });
  });
});
