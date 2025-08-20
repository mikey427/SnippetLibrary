import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { performance } from "perf_hooks";
import { SnippetManagerImpl } from "../../core/services/SnippetManagerImpl";
import { FileSystemStorageService } from "../../core/services/FileSystemStorageService";
import { SearchService } from "../../core/services/SearchService";
import { Snippet } from "../../core/models/Snippet";
import { SearchQuery } from "../../core/models/SearchQuery";
import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * Performance tests for large snippet collections
 * Tests system performance with realistic large datasets
 */
describe("Large Collection Performance Tests", () => {
  let snippetManager: SnippetManagerImpl;
  let storageService: FileSystemStorageService;
  let searchService: SearchService;
  let tempDir: string;
  let largeSnippetCollection: Snippet[];

  const PERFORMANCE_THRESHOLDS = {
    SEARCH_MAX_TIME: 100, // ms
    LOAD_MAX_TIME: 500, // ms
    SAVE_MAX_TIME: 1000, // ms
    FILTER_MAX_TIME: 50, // ms
    BULK_OPERATION_MAX_TIME: 2000, // ms
  };

  beforeEach(async () => {
    // Create temporary directory for test storage
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "snippet-perf-test-"));

    // Initialize services
    storageService = new FileSystemStorageService({
      location: "custom",
      path: tempDir,
      format: "json",
      autoBackup: false,
      backupInterval: 0,
    });

    searchService = new SearchService();
    snippetManager = new SnippetManagerImpl(storageService, searchService);

    // Generate large snippet collection
    largeSnippetCollection = generateLargeSnippetCollection(5000);
  });

  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to cleanup temp directory:", error);
    }
  });

  function generateLargeSnippetCollection(count: number): Snippet[] {
    const languages = [
      "javascript",
      "typescript",
      "python",
      "java",
      "go",
      "rust",
      "cpp",
      "csharp",
    ];
    const categories = [
      "utility",
      "component",
      "algorithm",
      "pattern",
      "config",
      "test",
      "api",
      "ui",
    ];
    const commonTags = [
      "async",
      "util",
      "helper",
      "core",
      "advanced",
      "basic",
      "production",
      "debug",
    ];

    return Array.from({ length: count }, (_, i) => {
      const language = languages[i % languages.length];
      const category = categories[i % categories.length];
      const tagCount = Math.floor(Math.random() * 5) + 1;
      const tags = Array.from(
        { length: tagCount },
        () => commonTags[Math.floor(Math.random() * commonTags.length)]
      );

      return new Snippet({
        id: `snippet-${i}`,
        title: `${category} Snippet ${i}`,
        description: `A ${language} ${category} snippet for testing performance with index ${i}`,
        code: generateCodeSnippet(language, i),
        language,
        tags: [...new Set(tags)], // Remove duplicates
        category,
        createdAt: new Date(
          Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
        ), // Random date within last year
        updatedAt: new Date(),
        usageCount: Math.floor(Math.random() * 100),
      });
    });
  }

  function generateCodeSnippet(language: string, index: number): string {
    const codeTemplates = {
      javascript: `function snippet${index}() {\n  const result = processData(${index});\n  return result.map(item => item.value);\n}\n\nmodule.exports = snippet${index};`,
      typescript: `interface Data${index} {\n  id: number;\n  value: string;\n}\n\nfunction snippet${index}(data: Data${index}[]): string[] {\n  return data.map(item => item.value);\n}`,
      python: `def snippet_${index}(data):\n    """Process data for snippet ${index}"""\n    return [item['value'] for item in data if item['id'] == ${index}]`,
      java: `public class Snippet${index} {\n    public List<String> process(List<Data> data) {\n        return data.stream()\n            .filter(d -> d.getId() == ${index})\n            .map(Data::getValue)\n            .collect(Collectors.toList());\n    }\n}`,
      go: `func Snippet${index}(data []Data) []string {\n    var result []string\n    for _, item := range data {\n        if item.ID == ${index} {\n            result = append(result, item.Value)\n        }\n    }\n    return result\n}`,
    };

    return (
      codeTemplates[language as keyof typeof codeTemplates] ||
      `// ${language} snippet ${index}\nconsole.log("Snippet ${index}");`
    );
  }

  describe("Storage Performance", () => {
    it("should load large snippet collection within time threshold", async () => {
      // Pre-populate storage with large collection
      await storageService.saveSnippets(largeSnippetCollection);

      const startTime = performance.now();
      const loadedSnippets = await storageService.loadSnippets();
      const endTime = performance.now();

      const loadTime = endTime - startTime;

      expect(loadedSnippets).toHaveLength(largeSnippetCollection.length);
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOAD_MAX_TIME);

      console.log(
        `Load time for ${
          largeSnippetCollection.length
        } snippets: ${loadTime.toFixed(2)}ms`
      );
    });

    it("should save large snippet collection within time threshold", async () => {
      const startTime = performance.now();
      await storageService.saveSnippets(largeSnippetCollection);
      const endTime = performance.now();

      const saveTime = endTime - startTime;

      expect(saveTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SAVE_MAX_TIME);

      console.log(
        `Save time for ${
          largeSnippetCollection.length
        } snippets: ${saveTime.toFixed(2)}ms`
      );
    });

    it("should handle incremental saves efficiently", async () => {
      // Initial save
      await storageService.saveSnippets(largeSnippetCollection.slice(0, 1000));

      // Measure incremental saves
      const incrementalTimes: number[] = [];

      for (let i = 1000; i < 2000; i += 100) {
        const batch = largeSnippetCollection.slice(0, i);

        const startTime = performance.now();
        await storageService.saveSnippets(batch);
        const endTime = performance.now();

        incrementalTimes.push(endTime - startTime);
      }

      // Verify incremental saves don't degrade significantly
      const avgTime =
        incrementalTimes.reduce((a, b) => a + b, 0) / incrementalTimes.length;
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SAVE_MAX_TIME);

      console.log(`Average incremental save time: ${avgTime.toFixed(2)}ms`);
    });
  });

  describe("Search Performance", () => {
    beforeEach(async () => {
      // Initialize snippet manager with large collection
      await storageService.saveSnippets(largeSnippetCollection);
      const loadedSnippets = await storageService.loadSnippets();

      // Populate search service
      for (const snippet of loadedSnippets) {
        await snippetManager.createSnippet({
          title: snippet.title,
          description: snippet.description,
          code: snippet.code,
          language: snippet.language,
          tags: snippet.tags,
          category: snippet.category,
        });
      }
    });

    it("should perform text search within time threshold", async () => {
      const searchQueries = [
        "function",
        "snippet",
        "data",
        "process",
        "javascript",
        "utility",
        "async",
        "component",
      ];

      for (const queryText of searchQueries) {
        const query = new SearchQuery({ text: queryText });

        const startTime = performance.now();
        const results = await snippetManager.searchSnippets(query);
        const endTime = performance.now();

        const searchTime = endTime - startTime;

        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_MAX_TIME);
        expect(results.length).toBeGreaterThan(0);

        console.log(
          `Search "${queryText}" time: ${searchTime.toFixed(2)}ms, results: ${
            results.length
          }`
        );
      }
    });

    it("should perform filtered search within time threshold", async () => {
      const filterCombinations = [
        { language: "javascript" },
        { tags: ["util", "helper"] },
        { language: "typescript", tags: ["component"] },
        { text: "function", language: "javascript" },
        { text: "data", tags: ["util"] },
      ];

      for (const filters of filterCombinations) {
        const query = new SearchQuery(filters);

        const startTime = performance.now();
        const results = await snippetManager.searchSnippets(query);
        const endTime = performance.now();

        const searchTime = endTime - startTime;

        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FILTER_MAX_TIME);

        console.log(
          `Filter search time: ${searchTime.toFixed(2)}ms, results: ${
            results.length
          }`
        );
      }
    });

    it("should handle complex search queries efficiently", async () => {
      const complexQuery = new SearchQuery({
        text: "function data process",
        language: "javascript",
        tags: ["util", "helper"],
        sortBy: "usageCount",
        sortOrder: "desc",
      });

      const startTime = performance.now();
      const results = await snippetManager.searchSnippets(complexQuery);
      const endTime = performance.now();

      const searchTime = endTime - startTime;

      expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_MAX_TIME);
      expect(results.length).toBeGreaterThan(0);

      // Verify results are properly sorted
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].usageCount).toBeGreaterThanOrEqual(
          results[i].usageCount
        );
      }

      console.log(
        `Complex search time: ${searchTime.toFixed(2)}ms, results: ${
          results.length
        }`
      );
    });
  });

  describe("Bulk Operations Performance", () => {
    beforeEach(async () => {
      await storageService.saveSnippets(largeSnippetCollection);
    });

    it("should perform bulk updates within time threshold", async () => {
      const snippetsToUpdate = largeSnippetCollection.slice(0, 100);
      const updatePromises = snippetsToUpdate.map((snippet) =>
        snippetManager.updateSnippet(snippet.id, {
          tags: [...snippet.tags, "bulk-updated"],
          usageCount: snippet.usageCount + 1,
        })
      );

      const startTime = performance.now();
      await Promise.all(updatePromises);
      const endTime = performance.now();

      const bulkUpdateTime = endTime - startTime;

      expect(bulkUpdateTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.BULK_OPERATION_MAX_TIME
      );

      console.log(
        `Bulk update time for 100 snippets: ${bulkUpdateTime.toFixed(2)}ms`
      );
    });

    it("should perform bulk deletes within time threshold", async () => {
      const snippetsToDelete = largeSnippetCollection.slice(0, 50);
      const deletePromises = snippetsToDelete.map((snippet) =>
        snippetManager.deleteSnippet(snippet.id)
      );

      const startTime = performance.now();
      await Promise.all(deletePromises);
      const endTime = performance.now();

      const bulkDeleteTime = endTime - startTime;

      expect(bulkDeleteTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.BULK_OPERATION_MAX_TIME
      );

      console.log(
        `Bulk delete time for 50 snippets: ${bulkDeleteTime.toFixed(2)}ms`
      );
    });

    it("should handle concurrent operations efficiently", async () => {
      const concurrentOperations = [
        // Concurrent searches
        ...Array.from({ length: 10 }, (_, i) =>
          snippetManager.searchSnippets(
            new SearchQuery({ text: `snippet ${i}` })
          )
        ),
        // Concurrent updates
        ...Array.from({ length: 5 }, (_, i) =>
          snippetManager.updateSnippet(largeSnippetCollection[i].id, {
            usageCount: 999,
          })
        ),
        // Concurrent creates
        ...Array.from({ length: 3 }, (_, i) =>
          snippetManager.createSnippet({
            title: `Concurrent Snippet ${i}`,
            code: `console.log('concurrent ${i}');`,
            language: "javascript",
            tags: ["concurrent"],
          })
        ),
      ];

      const startTime = performance.now();
      const results = await Promise.allSettled(concurrentOperations);
      const endTime = performance.now();

      const concurrentTime = endTime - startTime;

      // Verify all operations completed
      const successfulOps = results.filter(
        (result) => result.status === "fulfilled"
      ).length;
      expect(successfulOps).toBe(concurrentOperations.length);

      expect(concurrentTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.BULK_OPERATION_MAX_TIME
      );

      console.log(`Concurrent operations time: ${concurrentTime.toFixed(2)}ms`);
    });
  });

  describe("Memory Usage Performance", () => {
    it("should maintain reasonable memory usage with large collections", async () => {
      const initialMemory = process.memoryUsage();

      // Load large collection
      await storageService.saveSnippets(largeSnippetCollection);
      const loadedSnippets = await storageService.loadSnippets();

      // Perform various operations
      await snippetManager.searchSnippets(
        new SearchQuery({ text: "function" })
      );
      await snippetManager.searchSnippets(
        new SearchQuery({ language: "javascript" })
      );

      const finalMemory = process.memoryUsage();

      // Memory increase should be reasonable (less than 100MB for 5000 snippets)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      expect(memoryIncreaseMB).toBeLessThan(100);
      expect(loadedSnippets).toHaveLength(largeSnippetCollection.length);

      console.log(
        `Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for ${
          largeSnippetCollection.length
        } snippets`
      );
    });

    it("should handle memory cleanup after operations", async () => {
      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operations
      for (let i = 0; i < 10; i++) {
        const batch = generateLargeSnippetCollection(1000);
        await storageService.saveSnippets(batch);
        await storageService.loadSnippets();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      // Memory should not grow excessively
      expect(memoryIncreaseMB).toBeLessThan(200);

      console.log(
        `Memory after cleanup: ${memoryIncreaseMB.toFixed(2)}MB increase`
      );
    });
  });

  describe("Scalability Tests", () => {
    it("should scale linearly with collection size", async () => {
      const collectionSizes = [1000, 2000, 3000, 4000, 5000];
      const searchTimes: number[] = [];

      for (const size of collectionSizes) {
        const collection = generateLargeSnippetCollection(size);
        await storageService.saveSnippets(collection);

        const startTime = performance.now();
        await snippetManager.searchSnippets(
          new SearchQuery({ text: "function" })
        );
        const endTime = performance.now();

        searchTimes.push(endTime - startTime);

        console.log(
          `Search time for ${size} snippets: ${(endTime - startTime).toFixed(
            2
          )}ms`
        );
      }

      // Verify search time doesn't grow exponentially
      // Time should not more than double when collection size doubles
      for (let i = 1; i < searchTimes.length; i++) {
        const ratio = searchTimes[i] / searchTimes[i - 1];
        expect(ratio).toBeLessThan(2.5); // Allow some variance
      }
    });

    it("should handle stress test with maximum realistic load", async () => {
      // Simulate maximum realistic load: 10,000 snippets
      const maxCollection = generateLargeSnippetCollection(10000);

      const startTime = performance.now();

      // Save large collection
      await storageService.saveSnippets(maxCollection);

      // Load and search
      const loadedSnippets = await storageService.loadSnippets();
      const searchResults = await snippetManager.searchSnippets(
        new SearchQuery({ text: "snippet" })
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(loadedSnippets).toHaveLength(10000);
      expect(searchResults.length).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(
        `Stress test with 10,000 snippets completed in: ${totalTime.toFixed(
          2
        )}ms`
      );
    });
  });
});
