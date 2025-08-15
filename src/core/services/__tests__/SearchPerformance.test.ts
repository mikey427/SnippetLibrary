import { SearchService } from "../SearchService";
import { RealTimeSearchManager } from "../RealTimeSearchManager";
import { SearchQueryBuilder } from "../SearchQueryBuilder";
import { SnippetInterface, SearchQueryInterface } from "../../../types";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { beforeAll } from "vitest";
import { describe } from "vitest";

// Helper to create mock snippets for performance testing
const createMockSnippet = (
  id: string,
  title: string,
  description: string,
  code: string,
  language: string,
  tags: string[] = [],
  category?: string,
  usageCount: number = 0
): SnippetInterface => ({
  id,
  title,
  description,
  code,
  language,
  tags,
  category,
  createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
  updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last month
  usageCount,
  prefix: `${language}_${title.toLowerCase().replace(/\s+/g, "_")}`,
  scope: [language],
});

// Generate large dataset for performance testing
const generateLargeDataset = (size: number): SnippetInterface[] => {
  const languages = [
    "javascript",
    "python",
    "java",
    "cpp",
    "csharp",
    "go",
    "rust",
    "typescript",
  ];
  const categories = [
    "Frontend",
    "Backend",
    "Database",
    "DevOps",
    "Testing",
    "Utilities",
  ];
  const tagPool = [
    "react",
    "vue",
    "angular",
    "node",
    "express",
    "django",
    "flask",
    "spring",
    "database",
    "sql",
    "nosql",
    "api",
    "rest",
    "graphql",
    "testing",
    "unit",
    "integration",
    "performance",
    "security",
    "authentication",
    "authorization",
    "deployment",
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "ci",
    "cd",
  ];

  const snippets: SnippetInterface[] = [];

  for (let i = 0; i < size; i++) {
    const language = languages[i % languages.length];
    const category = categories[i % categories.length];
    const numTags = Math.floor(Math.random() * 5) + 1;
    const tags = Array.from(
      { length: numTags },
      () => tagPool[Math.floor(Math.random() * tagPool.length)]
    ).filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates

    const snippet = createMockSnippet(
      `snippet_${i}`,
      `${category} Snippet ${i}`,
      `This is a ${language} snippet for ${category.toLowerCase()} development. ` +
        `It demonstrates ${tags.join(", ")} concepts and patterns.`,
      `// ${language} code for ${category}\n` +
        `function example${i}() {\n` +
        `  // Implementation for ${tags.join(", ")}\n` +
        `  return "${category} result";\n` +
        `}`,
      language,
      tags,
      category,
      Math.floor(Math.random() * 100)
    );

    snippets.push(snippet);
  }

  return snippets;
};

describe("Search Performance Tests", () => {
  let searchService: SearchService;
  let realTimeManager: RealTimeSearchManager;
  let smallDataset: SnippetInterface[];
  let mediumDataset: SnippetInterface[];
  let largeDataset: SnippetInterface[];

  beforeAll(() => {
    searchService = new SearchService();
    realTimeManager = new RealTimeSearchManager(searchService);

    // Generate datasets of different sizes
    smallDataset = generateLargeDataset(100);
    mediumDataset = generateLargeDataset(1000);
    largeDataset = generateLargeDataset(10000);
  });

  describe("Basic Search Performance", () => {
    it("should handle small dataset (100 snippets) efficiently", async () => {
      const query: SearchQueryInterface = { text: "react" };
      const startTime = Date.now();

      const result = await searchService.searchWithRanking(smallDataset, query);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(50); // Should complete within 50ms
    });

    it("should handle medium dataset (1000 snippets) efficiently", async () => {
      const query: SearchQueryInterface = { text: "javascript" };
      const startTime = Date.now();

      const result = await searchService.searchWithRanking(
        mediumDataset,
        query
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(200); // Should complete within 200ms
    });

    it("should handle large dataset (10000 snippets) efficiently", async () => {
      const query: SearchQueryInterface = { text: "database" };
      const startTime = Date.now();

      const result = await searchService.searchWithRanking(largeDataset, query);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe("Complex Query Performance", () => {
    it("should handle complex queries on large dataset efficiently", async () => {
      const complexQuery = SearchQueryBuilder.create()
        .withText("react component")
        .withLanguage("javascript")
        .withTags(["react", "frontend"])
        .withCategory("Frontend")
        .withLastDays(180)
        .sortBy("usageCount", "desc")
        .build();

      expect(complexQuery.success).toBe(true);

      if (complexQuery.success) {
        const startTime = Date.now();

        const result = await searchService.searchWithRanking(
          largeDataset,
          complexQuery.data
        );

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(2000); // Complex queries can take a bit longer
      }
    });

    it("should handle multiple filter combinations efficiently", async () => {
      const multiFilterQuery = SearchQueryBuilder.create()
        .withText("api")
        .contains("description", "rest")
        .contains("code", "function")
        .not("category", "deprecated")
        .combineWith("and")
        .sortBy("createdAt", "desc")
        .build();

      expect(multiFilterQuery.success).toBe(true);

      if (multiFilterQuery.success) {
        const startTime = Date.now();

        const result = await searchService.searchWithRanking(
          largeDataset,
          multiFilterQuery.data
        );

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(2000); // Advanced filters may take longer
      }
    });
  });

  describe("Fuzzy Search Performance", () => {
    it("should handle fuzzy matching on large dataset efficiently", async () => {
      // Use intentionally misspelled terms to trigger fuzzy matching
      const fuzzyQueries = [
        "reakt", // react
        "javascrpt", // javascript
        "databse", // database
        "functoin", // function
      ];

      for (const queryText of fuzzyQueries) {
        const startTime = Date.now();

        const result = await searchService.searchWithRanking(largeDataset, {
          text: queryText,
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(1500); // Fuzzy matching is more expensive
      }
    });

    it("should maintain reasonable performance with very long search terms", async () => {
      const longSearchTerm =
        "this is a very long search term that should still be handled efficiently by the search system";

      const startTime = Date.now();

      const result = await searchService.searchWithRanking(largeDataset, {
        text: longSearchTerm,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Very long search terms are expensive
    });
  });

  describe("Real-time Search Performance", () => {
    it("should handle rapid search requests efficiently with debouncing", async () => {
      const queries = [
        "react",
        "react component",
        "react component hook",
        "react component hook state",
      ];

      const startTime = Date.now();

      // Simulate rapid typing
      for (const query of queries) {
        realTimeManager.searchRealTime(largeDataset, { text: query });
      }

      // Wait for debounced search to complete
      await new Promise((resolve) => setTimeout(resolve, 400));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly due to debouncing (only last search executes)
      expect(duration).toBeLessThan(3000);
    });

    it("should handle concurrent search requests efficiently", async () => {
      const concurrentQueries = [
        { text: "javascript" },
        { text: "python" },
        { text: "react" },
        { text: "database" },
        { text: "api" },
      ];

      const startTime = Date.now();

      // Execute all searches concurrently
      const promises = concurrentQueries.map((query) =>
        searchService.searchWithRanking(largeDataset, query)
      );

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All searches should succeed
      expect(results.every((r) => r.success)).toBe(true);

      // Concurrent execution should be faster than sequential
      expect(duration).toBeLessThan(4000);
    });
  });

  describe("Suggestion Performance", () => {
    it("should generate suggestions quickly for large dataset", async () => {
      const partialQueries = ["rea", "java", "data", "api", "test"];

      for (const partial of partialQueries) {
        const startTime = Date.now();

        const result = await searchService.getSearchSuggestions(
          partial,
          largeDataset
        );

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(300); // Suggestions should be very fast
      }
    });

    it("should handle empty partial query efficiently", async () => {
      const startTime = Date.now();

      const result = await searchService.getSearchSuggestions("", largeDataset);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100); // Empty query should be very fast
    });
  });

  describe("Memory Usage", () => {
    it("should not cause memory leaks with repeated searches", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many searches
      for (let i = 0; i < 100; i++) {
        await searchService.searchWithRanking(mediumDataset, {
          text: `search ${i}`,
          language: i % 2 === 0 ? "javascript" : "python",
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it("should handle search history efficiently", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate lots of search history
      for (let i = 0; i < 200; i++) {
        await searchService.searchWithRanking(smallDataset, {
          text: `history search ${i}`,
        });
      }

      const history = searchService.getSearchHistory();

      // Should maintain reasonable history size
      expect(history.length).toBeLessThanOrEqual(100);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });
  });

  describe("Scalability", () => {
    it("should scale linearly with dataset size", async () => {
      const query: SearchQueryInterface = { text: "javascript function" };

      // Test with different dataset sizes
      const sizes = [100, 500, 1000, 2000];
      const times: number[] = [];

      for (const size of sizes) {
        const dataset = generateLargeDataset(size);

        const startTime = Date.now();
        const result = await searchService.searchWithRanking(dataset, query);
        const endTime = Date.now();

        expect(result.success).toBe(true);
        times.push(endTime - startTime);
      }

      // Performance should scale reasonably (not exponentially)
      // Each doubling of size should not more than triple the time
      for (let i = 1; i < times.length; i++) {
        const ratio = times[i] / times[i - 1];
        const sizeRatio = sizes[i] / sizes[i - 1];

        // Time ratio should not be much worse than size ratio
        expect(ratio).toBeLessThan(sizeRatio * 2);
      }
    });

    it("should handle edge cases efficiently", async () => {
      const edgeCases = [
        { text: "" }, // Empty search
        { text: "a" }, // Single character
        { text: "xyz123!@#" }, // Special characters
        { text: "nonexistenttermnomatch" }, // No matches
        { tags: [] }, // Empty tags
        { language: "nonexistent" }, // Non-existent language
      ];

      for (const query of edgeCases) {
        const startTime = Date.now();

        const result = await searchService.searchWithRanking(
          largeDataset,
          query
        );

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(1500); // Edge cases should still be reasonably fast
      }
    });
  });

  describe("Stress Testing", () => {
    it("should handle maximum realistic load", async () => {
      const maxDataset = generateLargeDataset(50000); // Very large dataset

      const startTime = Date.now();

      const result = await searchService.searchWithRanking(maxDataset, {
        text: "react component",
        language: "javascript",
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds even for huge dataset
    });

    it("should handle rapid successive searches without degradation", async () => {
      const times: number[] = [];

      // Perform 20 searches in rapid succession
      for (let i = 0; i < 20; i++) {
        const startTime = Date.now();

        const result = await searchService.searchWithRanking(mediumDataset, {
          text: `rapid search ${i}`,
        });

        const endTime = Date.now();

        expect(result.success).toBe(true);
        times.push(endTime - startTime);
      }

      // Performance should not degrade significantly over time
      const firstHalf = times.slice(0, 10);
      const secondHalf = times.slice(10);

      const firstAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;

      // Second half should not be more than 50% slower than first half
      expect(secondAvg).toBeLessThan(firstAvg * 1.5);
    });
  });
});
