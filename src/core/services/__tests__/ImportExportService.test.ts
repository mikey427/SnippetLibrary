import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import {
  ImportExportService,
  ExportOptions,
  ImportOptions,
  BackupOptions,
} from "../ImportExportService";
import { SnippetManager } from "../../../interfaces";
import {
  SnippetInterface,
  SnippetData,
  ImportData,
  ImportResult,
  ExportData,
  ExportFilter,
  Result,
  ErrorType,
} from "../../../types";

// Mock fs module
vi.mock("fs/promises");
vi.mock("os");

describe("ImportExportService", () => {
  let importExportService: ImportExportService;
  let mockSnippetManager: SnippetManager;
  let tempDir: string;

  const mockSnippets: SnippetInterface[] = [
    {
      id: "1",
      title: "Console Log",
      description: "Basic console.log statement",
      code: "console.log('Hello World');",
      language: "javascript",
      tags: ["js", "debug"],
      category: "utility",
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-01"),
      usageCount: 5,
      prefix: "clog",
    },
    {
      id: "2",
      title: "Python Print",
      description: "Basic print statement",
      code: "print('Hello World')",
      language: "python",
      tags: ["py", "debug"],
      createdAt: new Date("2023-01-02"),
      updatedAt: new Date("2023-01-02"),
      usageCount: 3,
    },
  ];

  beforeEach(() => {
    tempDir = "/tmp/test-snippets";

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

    importExportService = new ImportExportService(mockSnippetManager);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("exportToFile", () => {
    const mockExportData: ExportData = {
      snippets: mockSnippets,
      metadata: {
        exportedAt: new Date("2023-01-01"),
        version: "1.0.0",
        count: 2,
      },
    };

    beforeEach(() => {
      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: true,
        data: mockExportData,
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it("should export snippets to JSON file", async () => {
      const options: ExportOptions = {
        format: "json",
        filePath: path.join(tempDir, "export.json"),
        includeMetadata: true,
      };

      const result = await importExportService.exportToFile(options);

      expect(result.success).toBe(true);
      expect(result.data).toBe(options.filePath);
      expect(mockSnippetManager.exportSnippets).toHaveBeenCalledWith(undefined);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining("test-snippets"),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("export.json"),
        expect.stringContaining('"snippets"'),
        "utf-8"
      );
    });

    it("should export snippets to YAML file", async () => {
      const options: ExportOptions = {
        format: "yaml",
        filePath: path.join(tempDir, "export.yaml"),
        includeMetadata: true,
      };

      const result = await importExportService.exportToFile(options);

      expect(result.success).toBe(true);
      expect(result.data).toBe(options.filePath);
      expect(fs.writeFile).toHaveBeenCalledWith(
        options.filePath,
        expect.stringContaining("snippets:"),
        "utf-8"
      );
    });

    it("should export without metadata when includeMetadata is false", async () => {
      const options: ExportOptions = {
        format: "json",
        filePath: path.join(tempDir, "export.json"),
        includeMetadata: false,
      };

      const result = await importExportService.exportToFile(options);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        options.filePath,
        expect.not.stringContaining("metadata"),
        "utf-8"
      );
    });

    it("should apply export filter", async () => {
      const filter: ExportFilter = {
        languages: ["javascript"],
        tags: ["debug"],
      };

      const options: ExportOptions = {
        format: "json",
        filePath: path.join(tempDir, "export.json"),
        filter,
      };

      const result = await importExportService.exportToFile(options);

      expect(result.success).toBe(true);
      expect(mockSnippetManager.exportSnippets).toHaveBeenCalledWith(filter);
    });

    it("should handle export errors from snippet manager", async () => {
      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: false,
        error: {
          type: ErrorType.unknown,
          message: "Export failed",
          recoverable: true,
        },
      } as any);

      const options: ExportOptions = {
        format: "json",
        filePath: path.join(tempDir, "export.json"),
      };

      const result = await importExportService.exportToFile(options);

      expect(result.success).toBe(false);
      expect((result as any).error.message).toBe("Export failed");
    });

    it("should handle file system errors", async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error("Permission denied"));

      const options: ExportOptions = {
        format: "json",
        filePath: path.join(tempDir, "export.json"),
      };

      const result = await importExportService.exportToFile(options);

      expect(result.success).toBe(false);
      expect((result as any).error.type).toBe(ErrorType.storageAccess);
    });
  });

  describe("importFromFile", () => {
    const mockImportResult: ImportResult = {
      imported: 2,
      skipped: 0,
      errors: [],
      conflicts: [],
    };

    beforeEach(() => {
      vi.mocked(mockSnippetManager.importSnippets).mockResolvedValue({
        success: true,
        data: mockImportResult,
      });
      vi.mocked(fs.access).mockResolvedValue(undefined);
    });

    it("should import snippets from JSON file", async () => {
      const jsonContent = JSON.stringify({
        snippets: [
          {
            title: "Test Snippet",
            description: "Test description",
            code: "console.log('test');",
            language: "javascript",
            tags: ["test"],
          },
        ],
      });

      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);

      const options: ImportOptions = {
        filePath: path.join(tempDir, "import.json"),
        conflictResolution: "skip",
      };

      const result = await importExportService.importFromFile(options);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockImportResult);
      expect(mockSnippetManager.importSnippets).toHaveBeenCalledWith({
        snippets: expect.arrayContaining([
          expect.objectContaining({
            title: "Test Snippet",
            language: "javascript",
          }),
        ]),
        conflictResolution: "skip",
      });
    });

    it("should import snippets from YAML file", async () => {
      const yamlContent = `
snippets:
  - title: Test Snippet
    description: Test description
    code: "console.log('test');"
    language: javascript
    tags:
      - test
`;

      vi.mocked(fs.readFile).mockResolvedValue(yamlContent);

      const options: ImportOptions = {
        filePath: path.join(tempDir, "import.yaml"),
        conflictResolution: "overwrite",
      };

      const result = await importExportService.importFromFile(options);

      expect(result.success).toBe(true);
      expect(mockSnippetManager.importSnippets).toHaveBeenCalledWith({
        snippets: expect.arrayContaining([
          expect.objectContaining({
            title: "Test Snippet",
            language: "javascript",
          }),
        ]),
        conflictResolution: "overwrite",
      });
    });

    it("should handle unwrapped snippet arrays", async () => {
      const jsonContent = JSON.stringify([
        {
          title: "Test Snippet",
          description: "Test description",
          code: "console.log('test');",
          language: "javascript",
          tags: ["test"],
        },
      ]);

      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);

      const options: ImportOptions = {
        filePath: path.join(tempDir, "import.json"),
        conflictResolution: "rename",
      };

      const result = await importExportService.importFromFile(options);

      expect(result.success).toBe(true);
      expect(mockSnippetManager.importSnippets).toHaveBeenCalledWith({
        snippets: expect.arrayContaining([
          expect.objectContaining({
            title: "Test Snippet",
          }),
        ]),
        conflictResolution: "rename",
      });
    });

    it("should handle file not found", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("File not found"));

      const options: ImportOptions = {
        filePath: path.join(tempDir, "nonexistent.json"),
        conflictResolution: "skip",
      };

      const result = await importExportService.importFromFile(options);

      expect(result.success).toBe(false);
      expect((result as any).error.type).toBe(ErrorType.storageAccess);
      expect((result as any).error.message).toBe("Import file not found");
    });

    it("should handle invalid JSON format", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("invalid json content");

      const options: ImportOptions = {
        filePath: path.join(tempDir, "invalid.json"),
        conflictResolution: "skip",
      };

      const result = await importExportService.importFromFile(options);

      expect(result.success).toBe(false);
      expect((result as any).error.type).toBe(ErrorType.validation);
    });

    it("should handle invalid YAML format", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("invalid: yaml: content: [");

      const options: ImportOptions = {
        filePath: path.join(tempDir, "invalid.yaml"),
        conflictResolution: "skip",
      };

      const result = await importExportService.importFromFile(options);

      expect(result.success).toBe(false);
      expect((result as any).error.type).toBe(ErrorType.validation);
    });

    it("should validate snippet data structure", async () => {
      const invalidContent = JSON.stringify({
        snippets: [
          {
            title: "Missing required fields",
            // Missing code and language
          },
        ],
      });

      vi.mocked(fs.readFile).mockResolvedValue(invalidContent);

      const options: ImportOptions = {
        filePath: path.join(tempDir, "invalid.json"),
        conflictResolution: "skip",
      };

      const result = await importExportService.importFromFile(options);

      expect(result.success).toBe(false);
      expect((result as any).error.type).toBe(ErrorType.validation);
      expect((result as any).error.message).toContain(
        "Invalid snippet at index 0"
      );
    });

    it("should validate tags are arrays", async () => {
      const invalidContent = JSON.stringify({
        snippets: [
          {
            title: "Test Snippet",
            code: "console.log('test');",
            language: "javascript",
            tags: "not-an-array", // Invalid tags format
          },
        ],
      });

      vi.mocked(fs.readFile).mockResolvedValue(invalidContent);

      const options: ImportOptions = {
        filePath: path.join(tempDir, "invalid.json"),
        conflictResolution: "skip",
      };

      const result = await importExportService.importFromFile(options);

      expect(result.success).toBe(false);
      expect((result as any).error.message).toContain(
        "Invalid tags at snippet index 0"
      );
    });
  });

  describe("createBackup", () => {
    beforeEach(() => {
      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: true,
        data: {
          snippets: mockSnippets,
          metadata: {
            exportedAt: new Date(),
            version: "1.0.0",
            count: 2,
          },
        },
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it("should create backup with timestamp", async () => {
      const options: BackupOptions = {
        format: "json",
        includeTimestamp: true,
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(true);
      expect(result.data).toMatch(/snippets-backup-.*\.json$/);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("should create backup without timestamp", async () => {
      const options: BackupOptions = {
        format: "yaml",
        includeTimestamp: false,
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(true);
      expect(result.data).toMatch(/snippets-backup\.yaml$/);
    });

    it("should create backup in custom path", async () => {
      const customPath = "/custom/backup/path";
      const options: BackupOptions = {
        format: "json",
        customPath,
        includeTimestamp: false,
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(true);
      expect(result.data).toBe(path.join(customPath, "snippets-backup.json"));
    });

    it("should handle backup creation errors", async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error("Disk full"));

      const options: BackupOptions = {
        format: "json",
      };

      const result = await importExportService.createBackup(options);

      expect(result.success).toBe(false);
      expect((result as any).error.type).toBe(ErrorType.storageAccess);
    });
  });

  describe("restoreFromBackup", () => {
    it("should restore from backup file", async () => {
      const backupContent = JSON.stringify({
        snippets: mockSnippets,
        metadata: {
          exportedAt: new Date(),
          version: "1.0.0",
          count: 2,
        },
      });

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(backupContent);
      vi.mocked(mockSnippetManager.importSnippets).mockResolvedValue({
        success: true,
        data: {
          imported: 2,
          skipped: 0,
          errors: [],
          conflicts: [],
        },
      });

      const backupPath = path.join(tempDir, "backup.json");
      const result = await importExportService.restoreFromBackup(backupPath);

      expect(result.success).toBe(true);

      // Verify import was called with overwrite resolution
      const importCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[0][0];
      expect(importCall.conflictResolution).toBe("overwrite");
      expect(importCall.snippets).toHaveLength(2);
      expect(importCall.snippets[0].title).toBe("Console Log");
      expect(importCall.snippets[1].title).toBe("Python Print");
    });
  });

  describe("format detection and validation", () => {
    it("should detect JSON format from .json extension", () => {
      expect(importExportService.isFormatSupported("json")).toBe(true);
    });

    it("should detect YAML format from .yaml extension", () => {
      expect(importExportService.isFormatSupported("yaml")).toBe(true);
    });

    it("should reject unsupported formats", () => {
      expect(importExportService.isFormatSupported("xml")).toBe(false);
      expect(importExportService.isFormatSupported("csv")).toBe(false);
    });

    it("should return supported formats", () => {
      const formats = importExportService.getSupportedFormats();
      expect(formats).toEqual(["json", "yaml"]);
    });
  });

  describe("error handling", () => {
    it("should handle snippet manager errors during export", async () => {
      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: false,
        error: {
          type: ErrorType.storageAccess,
          message: "Storage unavailable",
          recoverable: true,
        },
      } as any);

      const options: ExportOptions = {
        format: "json",
        filePath: path.join(tempDir, "export.json"),
      };

      const result = await importExportService.exportToFile(options);

      expect(result.success).toBe(false);
      expect((result as any).error.message).toBe("Storage unavailable");
    });

    it("should handle snippet manager errors during import", async () => {
      const jsonContent = JSON.stringify([
        {
          title: "Test Snippet",
          code: "console.log('test');",
          language: "javascript",
        },
      ]);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);
      vi.mocked(mockSnippetManager.importSnippets).mockResolvedValue({
        success: false,
        error: {
          type: ErrorType.validation,
          message: "Import validation failed",
          recoverable: true,
        },
      } as any);

      const options: ImportOptions = {
        filePath: path.join(tempDir, "import.json"),
        conflictResolution: "skip",
      };

      const result = await importExportService.importFromFile(options);

      expect(result.success).toBe(false);
      expect((result as any).error.message).toBe("Import validation failed");
    });
  });
});
