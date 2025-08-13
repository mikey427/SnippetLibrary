import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileSystemStorageService } from "./FileSystemStorageService";
import { Snippet, StorageLocation, StorageChange } from "../../types";
import { createSnippetFromData } from "../utils";

// Mock fs module
vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      access: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    statSync: vi.fn(),
    watch: vi.fn(),
    constants: {
      W_OK: 2,
      R_OK: 4,
    },
  };
});

describe("FileSystemStorageService", () => {
  let service: FileSystemStorageService;
  let tempDir: string;
  let mockSnippets: Snippet[];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create temp directory path
    tempDir = path.join(
      os.tmpdir(),
      "snippet-library-test",
      Date.now().toString()
    );

    // Create service with test config
    service = new FileSystemStorageService({
      location: "global",
      path: path.join(tempDir, "snippets.json"),
      format: "json",
      autoBackup: false, // Disable for tests
    });

    // Create mock snippets
    mockSnippets = [
      createSnippetFromData({
        title: "Test Snippet 1",
        description: "A test snippet",
        code: "console.log('test');",
        language: "javascript",
        tags: ["test", "console"],
      }),
      createSnippetFromData({
        title: "Test Snippet 2",
        description: "Another test snippet",
        code: "print('hello')",
        language: "python",
        tags: ["test", "print"],
      }),
    ];
  });

  afterEach(() => {
    service.dispose();
  });

  describe("loadSnippets", () => {
    it("should return empty array when file does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await service.loadSnippets();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should return empty array when file is empty", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue("");

      const result = await service.loadSnippets();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should load snippets from JSON file", async () => {
      const exportData = {
        snippets: mockSnippets,
        metadata: {
          exportedAt: new Date(),
          version: "1.0.0",
          count: mockSnippets.length,
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(exportData)
      );

      const result = await service.loadSnippets();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].title).toBe("Test Snippet 1");
    });

    it("should load snippets from array format", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(mockSnippets)
      );

      const result = await service.loadSnippets();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it("should handle invalid JSON format", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue("invalid json");

      const result = await service.loadSnippets();

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
    });

    it("should handle file read errors", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockRejectedValue(
        new Error("Permission denied")
      );

      const result = await service.loadSnippets();

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
      expect(result.error.message).toContain("Failed to load snippets");
    });
  });

  describe("saveSnippets", () => {
    it("should save snippets to JSON file", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      const result = await service.saveSnippets(mockSnippets);

      expect(result.success).toBe(true);
      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining("snippet-library-test"),
        { recursive: true }
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("snippets.json"),
        expect.stringContaining('"snippets"'),
        "utf-8"
      );
    });

    it("should handle write errors", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockRejectedValue(
        new Error("Disk full")
      );

      const result = await service.saveSnippets(mockSnippets);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
      expect(result.error.message).toContain("Failed to save snippets");
    });

    it("should handle directory creation errors", async () => {
      vi.mocked(fs.promises.mkdir).mockRejectedValue(
        new Error("Permission denied")
      );

      const result = await service.saveSnippets(mockSnippets);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
    });
  });

  describe("watchChanges", () => {
    it("should start watching for file changes", () => {
      const mockWatcher = {
        close: vi.fn(),
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as any);

      const callback = vi.fn();
      const result = service.watchChanges(callback);

      expect(result.success).toBe(true);
      expect(fs.watch).toHaveBeenCalled();
    });

    it("should create directory if it doesn't exist", () => {
      const mockWatcher = {
        close: vi.fn(),
      };
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as any);

      const callback = vi.fn();
      const result = service.watchChanges(callback);

      expect(result.success).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
    });

    it("should handle watch errors", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockImplementation(() => {
        throw new Error("Watch failed");
      });

      const callback = vi.fn();
      const result = service.watchChanges(callback);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
    });
  });

  describe("stopWatching", () => {
    it("should stop watching when watcher exists", () => {
      const mockWatcher = {
        close: vi.fn(),
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as any);

      // Start watching first
      service.watchChanges(vi.fn());

      const result = service.stopWatching();

      expect(result.success).toBe(true);
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it("should handle case when no watcher exists", () => {
      const result = service.stopWatching();

      expect(result.success).toBe(true);
    });
  });

  describe("getStorageLocation", () => {
    it("should return current storage location", () => {
      const result = service.getStorageLocation();

      expect(result.success).toBe(true);
      expect(result.data!.type).toBe("global");
      expect(result.data!.path).toContain("snippets.json");
    });
  });

  describe("setStorageLocation", () => {
    it("should update storage location", async () => {
      const newLocation: StorageLocation = {
        type: "workspace",
        path: path.join(tempDir, "workspace", "snippets.json"),
      };

      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);

      const result = await service.setStorageLocation(newLocation);

      expect(result.success).toBe(true);
      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.access).toHaveBeenCalled();
    });

    it("should handle invalid location", async () => {
      const newLocation: StorageLocation = {
        type: "invalid" as any,
        path: "/invalid/path",
      };

      const result = await service.setStorageLocation(newLocation);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("validation");
    });

    it("should handle access errors", async () => {
      const newLocation: StorageLocation = {
        type: "workspace",
        path: "/readonly/path/snippets.json",
      };

      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.access).mockRejectedValue(
        new Error("Permission denied")
      );

      const result = await service.setStorageLocation(newLocation);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
    });
  });

  describe("checkStorageAccess", () => {
    it("should return true for accessible storage", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await service.checkStorageAccess();

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it("should check file access when file exists", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await service.checkStorageAccess();

      expect(result.success).toBe(true);
      expect(fs.promises.access).toHaveBeenCalledTimes(2); // Directory and file
    });

    it("should handle access errors", async () => {
      vi.mocked(fs.promises.mkdir).mockRejectedValue(
        new Error("Permission denied")
      );

      const result = await service.checkStorageAccess();

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
    });
  });

  describe("createBackup", () => {
    it("should create backup file", async () => {
      // Mock loadSnippets
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({
          snippets: mockSnippets,
          metadata: { exportedAt: new Date(), version: "1.0.0", count: 2 },
        })
      );

      // Mock backup creation
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      const result = await service.createBackup();

      expect(result.success).toBe(true);
      expect(result.data).toContain("snippets-backup-");
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("snippets-backup-"),
        expect.stringContaining('"snippets"'),
        "utf-8"
      );
    });

    it("should handle backup creation errors", async () => {
      // Mock loadSnippets success
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({
          snippets: mockSnippets,
          metadata: { exportedAt: new Date(), version: "1.0.0", count: 2 },
        })
      );

      // Mock backup creation failure
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockRejectedValue(
        new Error("Disk full")
      );

      const result = await service.createBackup();

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
    });
  });

  describe("listBackups", () => {
    it("should return empty array when backup directory doesn't exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await service.listBackups();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should list backup files sorted by date", async () => {
      const backupFiles = [
        "snippets-backup-2023-01-01T10-00-00-000Z.json",
        "snippets-backup-2023-01-02T10-00-00-000Z.json",
        "other-file.txt",
      ];

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue(backupFiles as any);
      vi.mocked(fs.statSync).mockImplementation(
        (filePath) =>
          ({
            mtime: new Date(
              filePath.toString().includes("2023-01-02")
                ? "2023-01-02"
                : "2023-01-01"
            ),
          } as any)
      );

      const result = await service.listBackups();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0]).toContain("2023-01-02"); // Newest first
    });

    it("should handle readdir errors", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockRejectedValue(
        new Error("Permission denied")
      );

      const result = await service.listBackups();

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
    });
  });

  describe("restoreFromBackup", () => {
    it("should restore snippets from backup", async () => {
      const backupPath = path.join(tempDir, "backup.json");
      const backupData = {
        snippets: mockSnippets,
        metadata: { exportedAt: new Date(), version: "1.0.0", count: 2 },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(backupData)
      );

      const result = await service.restoreFromBackup(backupPath);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].title).toBe("Test Snippet 1");
    });

    it("should handle non-existent backup file", async () => {
      const backupPath = "/non/existent/backup.json";

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await service.restoreFromBackup(backupPath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
      expect(result.error.message).toContain("does not exist");
    });

    it("should handle invalid backup format", async () => {
      const backupPath = path.join(tempDir, "invalid-backup.json");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({ invalid: "format" })
      );

      const result = await service.restoreFromBackup(backupPath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
      expect(result.error.message).toContain("Invalid backup file format");
    });
  });

  describe("initialize", () => {
    it("should create directory structure and empty file", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      const result = await service.initialize();

      expect(result.success).toBe(true);
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(2); // Main dir and backup dir
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("snippets.json"),
        expect.stringContaining('"snippets": []'),
        "utf-8"
      );
    });

    it("should not overwrite existing file", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await service.initialize();

      expect(result.success).toBe(true);
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it("should handle initialization errors", async () => {
      vi.mocked(fs.promises.mkdir).mockRejectedValue(
        new Error("Permission denied")
      );

      const result = await service.initialize();

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("storage_access");
    });
  });

  describe("YAML format support", () => {
    beforeEach(() => {
      service = new FileSystemStorageService({
        location: "global",
        path: path.join(tempDir, "snippets.yaml"),
        format: "yaml",
        autoBackup: false,
      });
    });

    it("should save snippets in YAML format", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      const result = await service.saveSnippets(mockSnippets);

      expect(result.success).toBe(true);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("snippets.yaml"),
        expect.stringContaining("snippets:"),
        "utf-8"
      );
    });
  });

  describe("config management", () => {
    it("should return current config", () => {
      const config = service.getConfig();

      expect(config.location).toBe("global");
      expect(config.format).toBe("json");
      expect(config.autoBackup).toBe(false);
    });

    it("should update config", async () => {
      const result = await service.updateConfig({
        format: "yaml",
        autoBackup: true,
      });

      expect(result.success).toBe(true);

      const updatedConfig = service.getConfig();
      expect(updatedConfig.format).toBe("yaml");
      expect(updatedConfig.autoBackup).toBe(true);
    });

    it("should handle invalid config updates", async () => {
      const result = await service.updateConfig({
        location: "invalid" as any,
      });

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("validation");
    });
  });

  describe("dispose", () => {
    it("should clean up resources", () => {
      const mockWatcher = {
        close: vi.fn(),
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.watch).mockReturnValue(mockWatcher as any);

      // Start watching
      service.watchChanges(vi.fn());

      // Dispose should stop watching
      service.dispose();

      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });
});
