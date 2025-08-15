import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { ImportExportService } from "../ImportExportService";
import { SnippetManager } from "../../../interfaces";
import { SnippetInterface } from "../../../types";

// Mock fs and os modules
vi.mock("fs/promises");
vi.mock("os");

describe("ImportExportService - Integration Tests", () => {
  let importExportService: ImportExportService;
  let mockSnippetManager: SnippetManager;

  const testSnippets: SnippetInterface[] = [
    {
      id: "test-1",
      title: "React Hook",
      description: "Custom React hook for API calls",
      code: "const useApi = (url) => { /* implementation */ };",
      language: "javascript",
      tags: ["react", "hook", "api"],
      category: "frontend",
      createdAt: new Date("2023-01-01T10:00:00Z"),
      updatedAt: new Date("2023-01-01T10:00:00Z"),
      usageCount: 5,
    },
    {
      id: "test-2",
      title: "Python Decorator",
      description: "Timing decorator for performance measurement",
      code: "def timing_decorator(func): # implementation",
      language: "python",
      tags: ["python", "decorator", "performance"],
      category: "utility",
      createdAt: new Date("2023-01-02T10:00:00Z"),
      updatedAt: new Date("2023-01-02T10:00:00Z"),
      usageCount: 3,
    },
  ];

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

    // Create import/export service
    importExportService = new ImportExportService(mockSnippetManager);

    // Setup default mocks
    vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
      success: true,
      data: {
        snippets: testSnippets,
        metadata: {
          exportedAt: new Date("2023-01-05T12:00:00Z"),
          version: "1.0.0",
          count: 2,
        },
      },
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

    // Setup file system mocks
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue("{}");

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Complete Export/Import Workflow", () => {
    it("should export and import snippets maintaining data integrity", async () => {
      // Export to JSON
      const jsonExportResult = await importExportService.exportToFile({
        format: "json",
        filePath: "/tmp/export.json",
        includeMetadata: true,
      });

      expect(jsonExportResult.success).toBe(true);
      expect(mockSnippetManager.exportSnippets).toHaveBeenCalledWith(undefined);

      // Verify JSON content was written
      const jsonWriteCall = vi.mocked(fs.writeFile).mock.calls[0];
      const jsonContent = jsonWriteCall[1] as string;
      const jsonData = JSON.parse(jsonContent);

      expect(jsonData).toHaveProperty("snippets");
      expect(jsonData).toHaveProperty("metadata");
      expect(jsonData.snippets).toHaveLength(2);
      expect(jsonData.snippets[0].title).toBe("React Hook");

      // Test import from JSON
      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);

      const jsonImportResult = await importExportService.importFromFile({
        filePath: "/tmp/export.json",
        conflictResolution: "overwrite",
      });

      expect(jsonImportResult.success).toBe(true);
      expect(jsonImportResult.data.imported).toBe(2);

      const importCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[0][0];
      expect(importCall.conflictResolution).toBe("overwrite");
      expect(importCall.snippets).toHaveLength(2);
    });

    it("should handle backup creation and restoration", async () => {
      // Create backup
      const backupResult = await importExportService.createBackup({
        format: "json",
        includeTimestamp: true,
      });

      expect(backupResult.success).toBe(true);
      expect(backupResult.data).toMatch(/snippets-backup-.*\.json$/);

      // Verify backup content
      const backupWriteCall = vi.mocked(fs.writeFile).mock.calls[0];
      const backupContent = backupWriteCall[1] as string;
      const backupData = JSON.parse(backupContent);

      expect(backupData.snippets).toHaveLength(2);
      expect(backupData.metadata.count).toBe(2);

      // Test restore
      vi.mocked(fs.readFile).mockResolvedValue(backupContent);

      const restoreResult = await importExportService.restoreFromBackup(
        backupResult.data!
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.data.imported).toBe(2);

      const restoreCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[1][0];
      expect(restoreCall.conflictResolution).toBe("overwrite");
    });
  });

  describe("Format Support", () => {
    it("should support both JSON and YAML formats", async () => {
      // Test JSON export
      const jsonResult = await importExportService.exportToFile({
        format: "json",
        filePath: "/tmp/export.json",
      });

      expect(jsonResult.success).toBe(true);

      // Test YAML export
      const yamlResult = await importExportService.exportToFile({
        format: "yaml",
        filePath: "/tmp/export.yaml",
      });

      expect(yamlResult.success).toBe(true);

      // Verify content formats
      const jsonContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      const yamlContent = vi.mocked(fs.writeFile).mock.calls[1][1] as string;

      expect(jsonContent).toContain('"snippets"');
      expect(yamlContent).toContain("snippets:");
    });

    it("should validate supported formats", () => {
      expect(importExportService.isFormatSupported("json")).toBe(true);
      expect(importExportService.isFormatSupported("yaml")).toBe(true);
      expect(importExportService.isFormatSupported("xml")).toBe(false);

      const formats = importExportService.getSupportedFormats();
      expect(formats).toEqual(["json", "yaml"]);
    });
  });

  describe("Error Handling", () => {
    it("should handle export errors", async () => {
      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: false,
        error: {
          type: "storage_access" as any,
          message: "Storage unavailable",
          recoverable: true,
        },
      } as any);

      const result = await importExportService.exportToFile({
        format: "json",
        filePath: "/tmp/export.json",
      });

      expect(result.success).toBe(false);
      expect((result as any).error.message).toBe("Storage unavailable");
    });

    it("should handle import validation errors", async () => {
      const invalidData = JSON.stringify({
        snippets: [{ title: "Invalid" }], // Missing required fields
      });

      vi.mocked(fs.readFile).mockResolvedValue(invalidData);

      const result = await importExportService.importFromFile({
        filePath: "/tmp/invalid.json",
        conflictResolution: "skip",
      });

      expect(result.success).toBe(false);
      expect((result as any).error.type).toBe("validation");
    });
  });
});
