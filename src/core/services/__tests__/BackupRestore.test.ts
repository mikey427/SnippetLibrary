import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { ImportExportService, BackupOptions } from "../ImportExportService";
import { SnippetManager } from "../../../interfaces";
import { StorageService } from "../../../interfaces/StorageService";
import {
  SnippetInterface,
  ExportData,
  ImportResult,
  Result,
} from "../../../types";

// Mock fs and os modules
vi.mock("fs/promises");
vi.mock("os");

describe("ImportExportService - Backup and Restore", () => {
  let importExportService: ImportExportService;
  let mockSnippetManager: SnippetManager;
  let mockStorageService: StorageService;

  const sampleSnippets: SnippetInterface[] = [
    {
      id: "1",
      title: "Test Snippet 1",
      description: "First test snippet",
      code: "console.log('test 1');",
      language: "javascript",
      tags: ["test", "js"],
      category: "testing",
      createdAt: new Date("2023-01-01T10:00:00Z"),
      updatedAt: new Date("2023-01-01T10:00:00Z"),
      usageCount: 5,
    },
    {
      id: "2",
      title: "Test Snippet 2",
      description: "Second test snippet",
      code: "print('test 2')",
      language: "python",
      tags: ["test", "py"],
      createdAt: new Date("2023-01-02T10:00:00Z"),
      updatedAt: new Date("2023-01-02T10:00:00Z"),
      usageCount: 3,
    },
  ];

  const mockExportData: ExportData = {
    snippets: sampleSnippets,
    metadata: {
      exportedAt: new Date("2023-01-05T12:00:00Z"),
      version: "1.0.0",
      count: 2,
    },
  };

  beforeEach(() => {
    // Mock os.tmpdir
    vi.mocked(os.tmpdir).mockReturnValue("/tmp");

    // Create mock snippet manager
    mockSnippetManager = {
      createSnippet: vi.fn(),
      getSnippet: vi.fn(),
      updateSnippet: vi.fn(),
      deleteSnippet: vi.fn(),
      getAllSnippets: vi.fn(),
      searchSnippets: vi.fn(),
      importSnippets: vi.fn(),
      exportSnippets: vi.fn(),
      validateSnippet: vi.fn(),
      getUsageStats: vi.fn(),
      incrementUsage: vi.fn(),
    };

    // Create mock storage service
    mockStorageService = {
      initialize: vi.fn(),
      loadSnippets: vi.fn(),
      saveSnippets: vi.fn(),
      watchChanges: vi.fn(),
      getStorageLocation: vi.fn(),
      setStorageLocation: vi.fn(),
      updateConfig: vi.fn(),
      getConfig: vi.fn(),
      createBackup: vi.fn(),
      restoreFromBackup: vi.fn(),
      listBackups: vi.fn(),
      deleteBackup: vi.fn(),
    };

    importExportService = new ImportExportService(mockSnippetManager);

    // Setup default mocks
    vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
      success: true,
      data: mockExportData,
    });

    vi.mocked(mockSnippetManager.importSnippets).mockResolvedValue({
      success: true,
      data: {
        imported: 2,
        skipped: 0,
        errors: [],
        conflicts: [],
      },
    });

    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue("");

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createBackup", () => {
    it("should create backup with timestamp in default location", async () => {
      const options: BackupOptions = {
        format: "json",
        includeTimestamp: true,
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(true);
      expect(result.data).toMatch(
        /snippet-library-backups.*snippets-backup-.*\.json$/
      );

      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining("snippet-library-backups"),
        { recursive: true }
      );

      // Verify file write
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/snippets-backup-.*\.json$/),
        expect.stringContaining('"snippets"'),
        "utf-8"
      );

      // Verify export was called with no filter (all snippets)
      expect(mockSnippetManager.exportSnippets).toHaveBeenCalledWith(undefined);
    });

    it("should create backup without timestamp", async () => {
      const options: BackupOptions = {
        format: "yaml",
        includeTimestamp: false,
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(true);
      expect(result.data).toMatch(
        /snippet-library-backups.*snippets-backup\.yaml$/
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/snippets-backup\.yaml$/),
        expect.stringContaining("snippets:"),
        "utf-8"
      );
    });

    it("should create backup in custom path", async () => {
      const customPath = "/custom/backup/directory";
      const options: BackupOptions = {
        format: "json",
        customPath,
        includeTimestamp: false,
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(true);
      expect(result.data).toBe(path.join(customPath, "snippets-backup.json"));

      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining("custom"), {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(customPath, "snippets-backup.json"),
        expect.any(String),
        "utf-8"
      );
    });

    it("should include metadata in backup", async () => {
      const options: BackupOptions = {
        format: "json",
        includeTimestamp: false,
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(true);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const backupContent = writeCall[1] as string;
      const parsedBackup = JSON.parse(backupContent);

      expect(parsedBackup).toHaveProperty("snippets");
      expect(parsedBackup).toHaveProperty("metadata");
      expect(parsedBackup.metadata).toHaveProperty("exportedAt");
      expect(parsedBackup.metadata).toHaveProperty("version");
      expect(parsedBackup.metadata).toHaveProperty("count");
      expect(parsedBackup.snippets).toHaveLength(2);
    });

    it("should handle backup creation errors", async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error("Permission denied"));

      const options: BackupOptions = {
        format: "json",
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(false);
      expect((result as any).error.type).toBe("storage_access");
    });

    it("should handle export errors during backup", async () => {
      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: false,
        error: {
          type: "storage_access" as any,
          message: "Storage unavailable",
          recoverable: true,
        },
      } as any);

      const options: BackupOptions = {
        format: "json",
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(false);
      expect((result as any).error.message).toBe("Storage unavailable");
    });
  });

  describe("restoreFromBackup", () => {
    it("should restore from JSON backup", async () => {
      const backupContent = JSON.stringify({
        snippets: sampleSnippets,
        metadata: {
          exportedAt: new Date("2023-01-05T12:00:00Z"),
          version: "1.0.0",
          count: 2,
        },
      });

      vi.mocked(fs.readFile).mockResolvedValue(backupContent);

      const backupPath = "/tmp/backup.json";
      const result = await importExportService.restoreFromBackup(backupPath);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        imported: 2,
        skipped: 0,
        errors: [],
        conflicts: [],
      });

      // Verify import was called with overwrite resolution
      const importCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[0][0];
      expect(importCall.conflictResolution).toBe("overwrite");
      expect(importCall.snippets).toHaveLength(2);
      expect(importCall.snippets[0].title).toBe("Test Snippet 1");
      expect(importCall.snippets[1].title).toBe("Test Snippet 2");
    });

    it("should restore from YAML backup", async () => {
      const backupContent = `
snippets:
  - id: '1'
    title: Test Snippet 1
    description: First test snippet
    code: console.log('test 1');
    language: javascript
    tags:
      - test
      - js
    category: testing
    createdAt: 2023-01-01T10:00:00.000Z
    updatedAt: 2023-01-01T10:00:00.000Z
    usageCount: 5
metadata:
  exportedAt: 2023-01-05T12:00:00.000Z
  version: 1.0.0
  count: 1
`;

      vi.mocked(fs.readFile).mockResolvedValue(backupContent);

      const backupPath = "/tmp/backup.yaml";
      const result = await importExportService.restoreFromBackup(backupPath);

      expect(result.success).toBe(true);

      // Verify import was called with parsed YAML data
      const importCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[0][0];
      expect(importCall.snippets).toHaveLength(1);
      expect(importCall.snippets[0].title).toBe("Test Snippet 1");
      expect(importCall.conflictResolution).toBe("overwrite");
    });

    it("should handle backup file not found", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("File not found"));

      const backupPath = "/tmp/nonexistent-backup.json";
      const result = await importExportService.restoreFromBackup(backupPath);

      expect(result.success).toBe(false);
      expect((result as any).error.type).toBe("storage_access");
      expect((result as any).error.message).toBe("Import file not found");
    });

    it("should handle corrupted backup files", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("corrupted backup content");

      const backupPath = "/tmp/corrupted-backup.json";
      const result = await importExportService.restoreFromBackup(backupPath);

      expect(result.success).toBe(false);
      expect((result as any).error.type).toBe("validation");
    });

    it("should handle import errors during restore", async () => {
      const backupContent = JSON.stringify({
        snippets: sampleSnippets,
        metadata: {
          exportedAt: new Date(),
          version: "1.0.0",
          count: 2,
        },
      });

      vi.mocked(fs.readFile).mockResolvedValue(backupContent);
      vi.mocked(mockSnippetManager.importSnippets).mockResolvedValue({
        success: false,
        error: {
          type: "validation" as any,
          message: "Import validation failed",
          recoverable: true,
        },
      } as any);

      const backupPath = "/tmp/backup.json";
      const result = await importExportService.restoreFromBackup(backupPath);

      expect(result.success).toBe(false);
      expect((result as any).error.message).toBe("Import validation failed");
    });
  });

  describe("backup file naming and paths", () => {
    it("should generate unique backup names with timestamps", async () => {
      const options: BackupOptions = {
        format: "json",
        includeTimestamp: true,
      };

      // Create first backup
      const result1 = await importExportService.createBackup(options);

      // Wait a small amount to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create second backup
      const result2 = await importExportService.createBackup(options);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Both should be successful but have different paths due to timestamps
      expect(result1.data).not.toBe(result2.data);
      expect(result1.data).toMatch(/snippets-backup-.*\.json$/);
      expect(result2.data).toMatch(/snippets-backup-.*\.json$/);
    });

    it("should use consistent naming without timestamps", async () => {
      const options: BackupOptions = {
        format: "yaml",
        includeTimestamp: false,
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(true);
      expect(result.data).toMatch(/snippets-backup\.yaml$/);
    });

    it("should handle different file formats in backup names", async () => {
      const jsonOptions: BackupOptions = {
        format: "json",
        includeTimestamp: false,
      };

      const yamlOptions: BackupOptions = {
        format: "yaml",
        includeTimestamp: false,
      };

      const jsonResult = await importExportService.createBackup(jsonOptions);
      const yamlResult = await importExportService.createBackup(yamlOptions);

      expect(jsonResult.success).toBe(true);
      expect(yamlResult.success).toBe(true);

      expect(jsonResult.data).toMatch(/\.json$/);
      expect(yamlResult.data).toMatch(/\.yaml$/);
    });
  });

  describe("backup data integrity", () => {
    it("should preserve all snippet data in backup", async () => {
      const complexSnippet: SnippetInterface = {
        id: "complex",
        title: "Complex Snippet",
        description: "A snippet with all possible fields",
        code: `// Complex code example
function example() {
  const data = {
    nested: {
      array: [1, 2, 3],
      string: "value"
    }
  };
  return data;
}`,
        language: "javascript",
        tags: ["complex", "example", "nested"],
        category: "examples",
        createdAt: new Date("2023-01-01T10:00:00Z"),
        updatedAt: new Date("2023-01-02T15:30:00Z"),
        usageCount: 42,
        prefix: "complex",
        scope: ["javascript", "typescript"],
      };

      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: true,
        data: {
          snippets: [complexSnippet],
          metadata: {
            exportedAt: new Date("2023-01-05T12:00:00Z"),
            version: "1.0.0",
            count: 1,
          },
        },
      });

      const options: BackupOptions = {
        format: "json",
        includeTimestamp: false,
      };

      const backupResult = await importExportService.createBackup(options);
      expect(backupResult.success).toBe(true);

      // Verify backup content
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const backupContent = writeCall[1] as string;
      const parsedBackup = JSON.parse(backupContent);

      const backedUpSnippet = parsedBackup.snippets[0];
      expect(backedUpSnippet.id).toBe("complex");
      expect(backedUpSnippet.title).toBe("Complex Snippet");
      expect(backedUpSnippet.code).toContain("function example()");
      expect(backedUpSnippet.tags).toEqual(["complex", "example", "nested"]);
      expect(backedUpSnippet.category).toBe("examples");
      expect(backedUpSnippet.usageCount).toBe(42);
      expect(backedUpSnippet.prefix).toBe("complex");
      expect(backedUpSnippet.scope).toEqual(["javascript", "typescript"]);

      // Test restore
      vi.mocked(fs.readFile).mockResolvedValue(backupContent);

      const restoreResult = await importExportService.restoreFromBackup(
        backupResult.data!
      );
      expect(restoreResult.success).toBe(true);

      // Verify restored data matches original
      const importCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[0][0];
      const restoredSnippet = importCall.snippets[0];
      expect(restoredSnippet.title).toBe("Complex Snippet");
      expect(restoredSnippet.code).toContain("function example()");
      expect(restoredSnippet.tags).toEqual(["complex", "example", "nested"]);
      expect(restoredSnippet.usageCount).toBe(42);
    });

    it("should handle empty snippet collections in backup", async () => {
      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: true,
        data: {
          snippets: [],
          metadata: {
            exportedAt: new Date("2023-01-05T12:00:00Z"),
            version: "1.0.0",
            count: 0,
          },
        },
      });

      const options: BackupOptions = {
        format: "json",
        includeTimestamp: false,
      };

      const backupResult = await importExportService.createBackup(options);
      expect(backupResult.success).toBe(true);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const backupContent = writeCall[1] as string;
      const parsedBackup = JSON.parse(backupContent);

      expect(parsedBackup.snippets).toHaveLength(0);
      expect(parsedBackup.metadata.count).toBe(0);

      // Test restore of empty backup
      vi.mocked(fs.readFile).mockResolvedValue(backupContent);

      const restoreResult = await importExportService.restoreFromBackup(
        backupResult.data!
      );
      expect(restoreResult.success).toBe(true);

      const importCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[0][0];
      expect(importCall.snippets).toHaveLength(0);
    });
  });
});
