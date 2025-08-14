import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { SnippetManagerImpl } from "./SnippetManagerImpl";
import { StorageService } from "./StorageService";
import {
  Snippet,
  SnippetData,
  SearchQuery,
  ImportData,
  ExportFilter,
  Result,
  ErrorType,
  StorageChange,
} from "../../types";

// Mock storage service
const createMockStorageService = (): StorageService => ({
  loadSnippets: vi.fn(),
  saveSnippets: vi.fn(),
  watchChanges: vi.fn(),
  stopWatching: vi.fn(),
  getStorageLocation: vi.fn(),
  setStorageLocation: vi.fn(),
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  checkStorageAccess: vi.fn(),
  createBackup: vi.fn(),
  listBackups: vi.fn(),
  restoreFromBackup: vi.fn(),
  initialize: vi.fn(),
  dispose: vi.fn(),
});

// Test data
const createTestSnippetData = (
  overrides: Partial<SnippetData> = {}
): SnippetData => ({
  title: "Test Snippet",
  description: "A test snippet",
  code: "console.log('Hello, World!');",
  language: "javascript",
  tags: ["test", "example"],
  category: "utilities",
  prefix: "test",
  scope: ["javascript", "typescript"],
  ...overrides,
});

const createTestSnippet = (overrides: Partial<Snippet> = {}): Snippet => ({
  id: "test-id-1",
  title: "Test Snippet",
  description: "A test snippet",
  code: "console.log('Hello, World!');",
  language: "javascript",
  tags: ["test", "example"],
  category: "utilities",
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2023-01-01"),
  usageCount: 0,
  prefix: "test",
  scope: ["javascript", "typescript"],
  ...overrides,
});

describe("SnippetManagerImpl", () => {
  let snippetManager: SnippetManagerImpl;
  let mockStorageService: StorageService;

  beforeEach(() => {
    mockStorageService = createMockStorageService();
    snippetManager = new SnippetManagerImpl(mockStorageService);

    // Setup default mock implementations
    (mockStorageService.initialize as Mock).mockResolvedValue({
      success: true,
      data: undefined,
    });
    (mockStorageService.loadSnippets as Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (mockStorageService.saveSnippets as Mock).mockResolvedValue({
      success: true,
      data: undefined,
    });
    (mockStorageService.watchChanges as Mock).mockReturnValue({
      success: true,
      data: undefined,
    });
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      const result = await snippetManager.initialize();

      expect(result.success).toBe(true);
      expect(mockStorageService.initialize).toHaveBeenCalled();
      expect(mockStorageService.loadSnippets).toHaveBeenCalled();
      expect(mockStorageService.watchChanges).toHaveBeenCalled();
    });

    it("should handle initialization failure", async () => {
      (mockStorageService.initialize as Mock).mockResolvedValue({
        success: false,
        error: {
          type: ErrorType.storageAccess,
          message: "Storage initialization failed",
          recoverable: true,
        },
      });

      const result = await snippetManager.initialize();

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Storage initialization failed");
    });

    it("should handle load failure during initialization", async () => {
      (mockStorageService.loadSnippets as Mock).mockResolvedValue({
        success: false,
        error: {
          type: ErrorType.storageAccess,
          message: "Failed to load snippets",
          recoverable: true,
        },
      });

      const result = await snippetManager.initialize();

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Failed to load snippets");
    });
  });

  describe("createSnippet", () => {
    beforeEach(async () => {
      await snippetManager.initialize();
    });

    it("should create a new snippet successfully", async () => {
      const snippetData = createTestSnippetData();

      const result = await snippetManager.createSnippet(snippetData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe(snippetData.title);
      expect(result.data?.code).toBe(snippetData.code);
      expect(mockStorageService.saveSnippets).toHaveBeenCalled();
    });

    it("should reject duplicate titles", async () => {
      const snippetData = createTestSnippetData();

      // Create first snippet
      await snippetManager.createSnippet(snippetData);

      // Try to create duplicate
      const result = await snippetManager.createSnippet(snippetData);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(ErrorType.validation);
      expect(result.error?.message).toContain("already exists");
    });

    it("should handle storage save failure", async () => {
      (mockStorageService.saveSnippets as Mock).mockResolvedValue({
        success: false,
        error: {
          type: ErrorType.storageAccess,
          message: "Save failed",
          recoverable: true,
        },
      });

      const snippetData = createTestSnippetData();
      const result = await snippetManager.createSnippet(snippetData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Save failed");
    });

    it("should require initialization", async () => {
      const uninitializedManager = new SnippetManagerImpl(mockStorageService);
      const snippetData = createTestSnippetData();

      const result = await uninitializedManager.createSnippet(snippetData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("not initialized");
    });
  });

  describe("getSnippet", () => {
    beforeEach(async () => {
      await snippetManager.initialize();
    });

    it("should get an existing snippet", async () => {
      const snippetData = createTestSnippetData();
      const createResult = await snippetManager.createSnippet(snippetData);
      const snippetId = createResult.data!.id;

      const result = await snippetManager.getSnippet(snippetId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(snippetId);
      expect(result.data?.title).toBe(snippetData.title);
    });

    it("should return null for non-existent snippet", async () => {
      const result = await snippetManager.getSnippet("non-existent-id");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe("getAllSnippets", () => {
    beforeEach(async () => {
      await snippetManager.initialize();
    });

    it("should return empty array when no snippets exist", async () => {
      const result = await snippetManager.getAllSnippets();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should return all snippets", async () => {
      const snippet1 = createTestSnippetData({ title: "Snippet 1" });
      const snippet2 = createTestSnippetData({ title: "Snippet 2" });

      await snippetManager.createSnippet(snippet1);
      await snippetManager.createSnippet(snippet2);

      const result = await snippetManager.getAllSnippets();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.map((s) => s.title)).toContain("Snippet 1");
      expect(result.data?.map((s) => s.title)).toContain("Snippet 2");
    });
  });

  describe("updateSnippet", () => {
    beforeEach(async () => {
      await snippetManager.initialize();
    });

    it("should update an existing snippet", async () => {
      const snippetData = createTestSnippetData();
      const createResult = await snippetManager.createSnippet(snippetData);
      const snippetId = createResult.data!.id;

      const updates = {
        title: "Updated Title",
        description: "Updated description",
      };
      const result = await snippetManager.updateSnippet(snippetId, updates);

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe("Updated Title");
      expect(result.data?.description).toBe("Updated description");
      expect(mockStorageService.saveSnippets).toHaveBeenCalledTimes(2); // Create + Update
    });

    it("should reject updates that create title conflicts", async () => {
      const snippet1 = createTestSnippetData({ title: "Snippet 1" });
      const snippet2 = createTestSnippetData({ title: "Snippet 2" });

      const result1 = await snippetManager.createSnippet(snippet1);
      const result2 = await snippetManager.createSnippet(snippet2);

      // Try to update snippet2 to have the same title as snippet1
      const updateResult = await snippetManager.updateSnippet(
        result2.data!.id,
        {
          title: "Snippet 1",
        }
      );

      expect(updateResult.success).toBe(false);
      expect(updateResult.error?.type).toBe(ErrorType.validation);
      expect(updateResult.error?.message).toContain("already exists");
    });

    it("should handle non-existent snippet", async () => {
      const result = await snippetManager.updateSnippet("non-existent-id", {
        title: "New Title",
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(ErrorType.validation);
      expect(result.error?.message).toContain("not found");
    });
  });

  describe("deleteSnippet", () => {
    beforeEach(async () => {
      await snippetManager.initialize();
    });

    it("should delete an existing snippet", async () => {
      const snippetData = createTestSnippetData();
      const createResult = await snippetManager.createSnippet(snippetData);
      const snippetId = createResult.data!.id;

      const result = await snippetManager.deleteSnippet(snippetId);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);

      // Verify snippet is gone
      const getResult = await snippetManager.getSnippet(snippetId);
      expect(getResult.data).toBeNull();
    });

    it("should handle non-existent snippet", async () => {
      const result = await snippetManager.deleteSnippet("non-existent-id");

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(ErrorType.validation);
      expect(result.error?.message).toContain("not found");
    });

    it("should rollback on storage failure", async () => {
      const snippetData = createTestSnippetData();
      const createResult = await snippetManager.createSnippet(snippetData);
      const snippetId = createResult.data!.id;

      // Mock save failure
      (mockStorageService.saveSnippets as Mock).mockResolvedValueOnce({
        success: false,
        error: {
          type: ErrorType.storageAccess,
          message: "Save failed",
          recoverable: true,
        },
      });

      const result = await snippetManager.deleteSnippet(snippetId);

      expect(result.success).toBe(false);

      // Verify snippet is still there (rollback worked)
      const getResult = await snippetManager.getSnippet(snippetId);
      expect(getResult.data).toBeDefined();
    });
  });

  describe("searchSnippets", () => {
    beforeEach(async () => {
      await snippetManager.initialize();

      // Create test snippets
      await snippetManager.createSnippet(
        createTestSnippetData({
          title: "JavaScript Function",
          language: "javascript",
          tags: ["function", "utility"],
          category: "utilities",
        })
      );

      await snippetManager.createSnippet(
        createTestSnippetData({
          title: "Python Script",
          language: "python",
          tags: ["script", "automation"],
          category: "scripts",
        })
      );

      await snippetManager.createSnippet(
        createTestSnippetData({
          title: "TypeScript Interface",
          language: "typescript",
          tags: ["interface", "type"],
          category: "types",
        })
      );
    });

    it("should search by text", async () => {
      const query: SearchQuery = { text: "JavaScript" };
      const result = await snippetManager.searchSnippets(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].title).toBe("JavaScript Function");
    });

    it("should search by language", async () => {
      const query: SearchQuery = { language: "python" };
      const result = await snippetManager.searchSnippets(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].title).toBe("Python Script");
    });

    it("should search by tags", async () => {
      const query: SearchQuery = { tags: ["function"] };
      const result = await snippetManager.searchSnippets(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].title).toBe("JavaScript Function");
    });

    it("should search by category", async () => {
      const query: SearchQuery = { category: "scripts" };
      const result = await snippetManager.searchSnippets(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].title).toBe("Python Script");
    });

    it("should sort results", async () => {
      const query: SearchQuery = { sortBy: "title", sortOrder: "asc" };
      const result = await snippetManager.searchSnippets(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data?.[0].title).toBe("JavaScript Function");
      expect(result.data?.[1].title).toBe("Python Script");
      expect(result.data?.[2].title).toBe("TypeScript Interface");
    });

    it("should return empty results for no matches", async () => {
      const query: SearchQuery = { text: "nonexistent" };
      const result = await snippetManager.searchSnippets(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe("importSnippets", () => {
    beforeEach(async () => {
      await snippetManager.initialize();
    });

    it("should import new snippets", async () => {
      const importData: ImportData = {
        snippets: [
          createTestSnippetData({ title: "Import 1" }),
          createTestSnippetData({ title: "Import 2" }),
        ],
        conflictResolution: "skip",
      };

      const result = await snippetManager.importSnippets(importData);

      expect(result.success).toBe(true);
      expect(result.data?.imported).toBe(2);
      expect(result.data?.skipped).toBe(0);
      expect(result.data?.errors).toHaveLength(0);
    });

    it("should handle conflicts with skip resolution", async () => {
      // Create existing snippet
      await snippetManager.createSnippet(
        createTestSnippetData({ title: "Existing" })
      );

      const importData: ImportData = {
        snippets: [createTestSnippetData({ title: "Existing" })],
        conflictResolution: "skip",
      };

      const result = await snippetManager.importSnippets(importData);

      expect(result.success).toBe(true);
      expect(result.data?.imported).toBe(0);
      expect(result.data?.skipped).toBe(1);
      expect(result.data?.conflicts).toHaveLength(1);
      expect(result.data?.conflicts[0].resolution).toBe("skip");
    });

    it("should handle conflicts with rename resolution", async () => {
      // Create existing snippet
      await snippetManager.createSnippet(
        createTestSnippetData({ title: "Existing" })
      );

      const importData: ImportData = {
        snippets: [createTestSnippetData({ title: "Existing" })],
        conflictResolution: "rename",
      };

      const result = await snippetManager.importSnippets(importData);

      expect(result.success).toBe(true);
      expect(result.data?.imported).toBe(1);
      expect(result.data?.skipped).toBe(0);
      expect(result.data?.conflicts).toHaveLength(1);
      expect(result.data?.conflicts[0].resolution).toBe("rename");
      expect(result.data?.conflicts[0].newName).toBe("Existing (1)");
    });
  });

  describe("exportSnippets", () => {
    beforeEach(async () => {
      await snippetManager.initialize();

      // Create test snippets
      await snippetManager.createSnippet(
        createTestSnippetData({
          title: "JS Snippet",
          language: "javascript",
          tags: ["js"],
        })
      );

      await snippetManager.createSnippet(
        createTestSnippetData({
          title: "Python Snippet",
          language: "python",
          tags: ["py"],
        })
      );
    });

    it("should export all snippets without filter", async () => {
      const result = await snippetManager.exportSnippets();

      expect(result.success).toBe(true);
      expect(result.data?.snippets).toHaveLength(2);
      expect(result.data?.metadata.count).toBe(2);
    });

    it("should export filtered snippets by language", async () => {
      const filter: ExportFilter = { languages: ["javascript"] };
      const result = await snippetManager.exportSnippets(filter);

      expect(result.success).toBe(true);
      expect(result.data?.snippets).toHaveLength(1);
      expect(result.data?.snippets[0].language).toBe("javascript");
    });

    it("should export filtered snippets by tags", async () => {
      const filter: ExportFilter = { tags: ["py"] };
      const result = await snippetManager.exportSnippets(filter);

      expect(result.success).toBe(true);
      expect(result.data?.snippets).toHaveLength(1);
      expect(result.data?.snippets[0].tags).toContain("py");
    });
  });

  describe("incrementUsage", () => {
    beforeEach(async () => {
      await snippetManager.initialize();
    });

    it("should increment usage count", async () => {
      const createResult = await snippetManager.createSnippet(
        createTestSnippetData()
      );
      const snippetId = createResult.data!.id;

      const result = await snippetManager.incrementUsage(snippetId);

      expect(result.success).toBe(true);

      const getResult = await snippetManager.getSnippet(snippetId);
      expect(getResult.data?.usageCount).toBe(1);
    });

    it("should handle non-existent snippet", async () => {
      const result = await snippetManager.incrementUsage("non-existent-id");

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(ErrorType.validation);
    });
  });

  describe("getUsageStatistics", () => {
    beforeEach(async () => {
      await snippetManager.initialize();

      // Create test snippets with different usage counts
      const snippet1 = await snippetManager.createSnippet(
        createTestSnippetData({ title: "Popular", language: "javascript" })
      );
      const snippet2 = await snippetManager.createSnippet(
        createTestSnippetData({ title: "Less Popular", language: "python" })
      );

      // Increment usage
      await snippetManager.incrementUsage(snippet1.data!.id);
      await snippetManager.incrementUsage(snippet1.data!.id);
      await snippetManager.incrementUsage(snippet2.data!.id);
    });

    it("should return usage statistics", async () => {
      const result = await snippetManager.getUsageStatistics();

      expect(result.success).toBe(true);
      expect(result.data?.totalSnippets).toBe(2);
      expect(result.data?.totalUsage).toBe(3);
      expect(result.data?.averageUsage).toBe(1.5);
      expect(result.data?.mostUsedSnippets).toHaveLength(2);
      expect(result.data?.mostUsedSnippets[0].usageCount).toBe(2);
      expect(result.data?.languageDistribution).toHaveLength(2);
    });
  });

  describe("utility methods", () => {
    beforeEach(async () => {
      await snippetManager.initialize();

      // Create test snippets
      await snippetManager.createSnippet(
        createTestSnippetData({
          title: "JS Snippet",
          language: "javascript",
          tags: ["js", "utility"],
          category: "utilities",
        })
      );

      await snippetManager.createSnippet(
        createTestSnippetData({
          title: "Python Snippet",
          language: "python",
          tags: ["py", "script"],
          category: "scripts",
        })
      );
    });

    it("should get snippets by language", async () => {
      const result = await snippetManager.getSnippetsByLanguage("javascript");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].language).toBe("javascript");
    });

    it("should get snippets by tags", async () => {
      const result = await snippetManager.getSnippetsByTags(["js"]);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].tags).toContain("js");
    });

    it("should get snippets by category", async () => {
      const result = await snippetManager.getSnippetsByCategory("utilities");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].category).toBe("utilities");
    });

    it("should get all languages", async () => {
      const result = await snippetManager.getLanguages();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(["javascript", "python"]);
    });

    it("should get all tags", async () => {
      const result = await snippetManager.getTags();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(["js", "py", "script", "utility"]);
    });

    it("should get all categories", async () => {
      const result = await snippetManager.getCategories();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(["scripts", "utilities"]);
    });
  });

  describe("refresh", () => {
    beforeEach(async () => {
      await snippetManager.initialize();
    });

    it("should refresh snippets from storage", async () => {
      const result = await snippetManager.refresh();

      expect(result.success).toBe(true);
      expect(mockStorageService.loadSnippets).toHaveBeenCalledTimes(2); // Init + Refresh
    });
  });

  describe("dispose", () => {
    beforeEach(async () => {
      await snippetManager.initialize();
    });

    it("should clean up resources", () => {
      snippetManager.dispose();

      expect(mockStorageService.stopWatching).toHaveBeenCalled();
      expect(mockStorageService.dispose).toHaveBeenCalled();
    });
  });
});
