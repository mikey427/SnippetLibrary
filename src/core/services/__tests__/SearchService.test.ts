import {
  SearchService,
  SearchResult,
  SearchSuggestion,
} from "../SearchService";
import { SnippetInterface, SearchQueryInterface } from "../../../types";

// Mock data for testing
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
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  usageCount,
  prefix: `${language}_${title.toLowerCase().replace(/\s+/g, "_")}`,
  scope: [language],
});

const mockSnippets: SnippetInterface[] = [
  createMockSnippet(
    "1",
    "React Component",
    "A basic React functional component",
    "const Component = () => {\n  return <div>Hello</div>;\n};",
    "javascript",
    ["react", "component", "frontend"],
    "React",
    10
  ),
  createMockSnippet(
    "2",
    "Python Function",
    "A simple Python function",
    "def hello_world():\n    print('Hello, World!')",
    "python",
    ["function", "basic"],
    "Python",
    5
  ),
  createMockSnippet(
    "3",
    "SQL Query",
    "Select all users from database",
    "SELECT * FROM users WHERE active = 1;",
    "sql",
    ["database", "query", "users"],
    "Database",
    15
  ),
  createMockSnippet(
    "4",
    "React Hook",
    "Custom React hook for API calls",
    "const useApi = (url) => {\n  const [data, setData] = useState(null);\n  // ...\n};",
    "javascript",
    ["react", "hook", "api"],
    "React",
    8
  ),
  createMockSnippet(
    "5",
    "CSS Flexbox",
    "Flexbox layout utility",
    ".flex-center {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}",
    "css",
    ["css", "layout", "flexbox"],
    "CSS",
    3
  ),
];

describe("SearchService", () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService();
  });

  describe("searchWithRanking", () => {
    it("should return all snippets when query is empty", async () => {
      const query: SearchQueryInterface = {};
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(mockSnippets.length);
        expect(result.data.every((r) => r.score === 1.0)).toBe(true);
      }
    });

    it("should perform text search with fuzzy matching", async () => {
      const query: SearchQueryInterface = { text: "react" };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0);

        // Should find React-related snippets
        const reactSnippets = result.data.filter(
          (r) =>
            r.snippet.title.toLowerCase().includes("react") ||
            r.snippet.description.toLowerCase().includes("react") ||
            r.snippet.tags.some((tag) => tag.toLowerCase().includes("react"))
        );

        expect(reactSnippets.length).toBeGreaterThan(0);

        // Results should be sorted by relevance (score descending)
        for (let i = 1; i < result.data.length; i++) {
          expect(result.data[i].score).toBeLessThanOrEqual(
            result.data[i - 1].score
          );
        }
      }
    });

    it("should filter by language", async () => {
      const query: SearchQueryInterface = { language: "javascript" };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2); // React Component and React Hook
        expect(
          result.data.every((r) => r.snippet.language === "javascript")
        ).toBe(true);
      }
    });

    it("should filter by tags", async () => {
      const query: SearchQueryInterface = { tags: ["react"] };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2); // React Component and React Hook
        expect(
          result.data.every((r) =>
            r.snippet.tags.some((tag) => tag.toLowerCase().includes("react"))
          )
        ).toBe(true);
      }
    });

    it("should filter by category", async () => {
      const query: SearchQueryInterface = { category: "React" };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2); // React Component and React Hook
        expect(result.data.every((r) => r.snippet.category === "React")).toBe(
          true
        );
      }
    });

    it("should filter by date range", async () => {
      const start = new Date("2023-12-01");
      const end = new Date("2024-02-01");
      const query: SearchQueryInterface = { dateRange: { start, end } };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(mockSnippets.length); // All snippets are in range
      }
    });

    it("should sort by title", async () => {
      const query: SearchQueryInterface = {
        sortBy: "title",
        sortOrder: "asc",
      };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        const titles = result.data.map((r) => r.snippet.title);
        const sortedTitles = [...titles].sort();
        expect(titles).toEqual(sortedTitles);
      }
    });

    it("should sort by usage count", async () => {
      const query: SearchQueryInterface = {
        sortBy: "usageCount",
        sortOrder: "desc",
      };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        const usageCounts = result.data.map((r) => r.snippet.usageCount);
        for (let i = 1; i < usageCounts.length; i++) {
          expect(usageCounts[i]).toBeLessThanOrEqual(usageCounts[i - 1]);
        }
      }
    });

    it("should combine multiple filters", async () => {
      const query: SearchQueryInterface = {
        text: "react",
        language: "javascript",
        tags: ["component"],
      };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(1); // Only React Component matches all criteria
        expect(result.data[0].snippet.title).toBe("React Component");
      }
    });

    it("should rank results by relevance", async () => {
      const query: SearchQueryInterface = { text: "react" };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        // Results should be sorted by score (descending)
        for (let i = 1; i < result.data.length; i++) {
          expect(result.data[i].score).toBeLessThanOrEqual(
            result.data[i - 1].score
          );
        }
      }
    });

    it("should include match information", async () => {
      const query: SearchQueryInterface = { text: "react" };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        const firstResult = result.data[0];
        expect(firstResult.matches).toBeDefined();
        expect(firstResult.matches.length).toBeGreaterThan(0);
        expect(firstResult.matches[0]).toHaveProperty("field");
        expect(firstResult.matches[0]).toHaveProperty("text");
        expect(firstResult.matches[0]).toHaveProperty("startIndex");
        expect(firstResult.matches[0]).toHaveProperty("endIndex");
        expect(firstResult.matches[0]).toHaveProperty("score");
      }
    });
  });

  describe("getSearchSuggestions", () => {
    beforeEach(() => {
      // Add some search history
      searchService.searchWithRanking(mockSnippets, {
        text: "react component",
      });
      searchService.searchWithRanking(mockSnippets, {
        text: "python function",
      });
      searchService.searchWithRanking(mockSnippets, { text: "react hook" });
    });

    it("should return suggestions based on partial query", async () => {
      const result = await searchService.getSearchSuggestions(
        "rea",
        mockSnippets
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0);
        expect(
          result.data.some((s) => s.text.toLowerCase().includes("react"))
        ).toBe(true);
      }
    });

    it("should include different types of suggestions", async () => {
      const result = await searchService.getSearchSuggestions(
        "react",
        mockSnippets
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const types = new Set(result.data.map((s) => s.type));
        expect(types.size).toBeGreaterThan(1); // Should have multiple types
      }
    });

    it("should limit suggestions to reasonable number", async () => {
      const result = await searchService.getSearchSuggestions("", mockSnippets);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeLessThanOrEqual(10);
      }
    });

    it("should return tag suggestions", async () => {
      const result = await searchService.getSearchSuggestions(
        "comp",
        mockSnippets
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(
          result.data.some(
            (s) => s.type === "tag" && s.text.includes("component")
          )
        ).toBe(true);
      }
    });

    it("should return language suggestions", async () => {
      const result = await searchService.getSearchSuggestions(
        "java",
        mockSnippets
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(
          result.data.some(
            (s) => s.type === "language" && s.text === "javascript"
          )
        ).toBe(true);
      }
    });

    it("should return category suggestions", async () => {
      const result = await searchService.getSearchSuggestions(
        "rea",
        mockSnippets
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(
          result.data.some((s) => s.type === "category" && s.text === "React")
        ).toBe(true);
      }
    });
  });

  describe("search history", () => {
    it("should track search history", async () => {
      await searchService.searchWithRanking(mockSnippets, { text: "react" });
      await searchService.searchWithRanking(mockSnippets, { text: "python" });

      const history = searchService.getSearchHistory();
      expect(history.length).toBe(2);
      expect(history[0].query.text).toBe("python"); // Most recent first
      expect(history[1].query.text).toBe("react");
    });

    it("should not track empty queries in history", async () => {
      await searchService.searchWithRanking(mockSnippets, {});
      const history = searchService.getSearchHistory();
      expect(history.length).toBe(0);
    });

    it("should clear search history", async () => {
      await searchService.searchWithRanking(mockSnippets, { text: "react" });
      searchService.clearSearchHistory();
      const history = searchService.getSearchHistory();
      expect(history.length).toBe(0);
    });

    it("should get popular search terms", async () => {
      await searchService.searchWithRanking(mockSnippets, { text: "react" });
      await searchService.searchWithRanking(mockSnippets, { text: "react" });
      await searchService.searchWithRanking(mockSnippets, { text: "python" });

      const popularTerms = searchService.getPopularSearchTerms();
      expect(popularTerms[0]).toBe("react"); // Most popular first
      expect(popularTerms[1]).toBe("python");
    });
  });

  describe("performance", () => {
    it("should handle large number of snippets efficiently", async () => {
      // Create a large dataset
      const largeDataset: SnippetInterface[] = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push(
          createMockSnippet(
            `snippet_${i}`,
            `Snippet ${i}`,
            `Description for snippet ${i}`,
            `code for snippet ${i}`,
            i % 2 === 0 ? "javascript" : "python",
            [`tag${i % 10}`, `category${i % 5}`],
            `Category${i % 3}`,
            Math.floor(Math.random() * 100)
          )
        );
      }

      const startTime = Date.now();
      const result = await searchService.searchWithRanking(largeDataset, {
        text: "snippet",
      });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle complex queries efficiently", async () => {
      const complexQuery: SearchQueryInterface = {
        text: "react component",
        language: "javascript",
        tags: ["react", "component"],
        category: "React",
        sortBy: "usageCount",
        sortOrder: "desc",
      };

      const startTime = Date.now();
      const result = await searchService.searchWithRanking(
        mockSnippets,
        complexQuery
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast for small dataset
    });
  });

  describe("fuzzy matching", () => {
    it("should find approximate matches", async () => {
      const query: SearchQueryInterface = { text: "reakt" }; // Typo in "react"
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should still find React-related snippets due to fuzzy matching
        expect(result.data.length).toBeGreaterThan(0);
      }
    });

    it("should score exact matches higher than fuzzy matches", async () => {
      const exactQuery: SearchQueryInterface = { text: "react" };
      const fuzzyQuery: SearchQueryInterface = { text: "reakt" };

      const exactResult = await searchService.searchWithRanking(
        mockSnippets,
        exactQuery
      );
      const fuzzyResult = await searchService.searchWithRanking(
        mockSnippets,
        fuzzyQuery
      );

      expect(exactResult.success).toBe(true);
      expect(fuzzyResult.success).toBe(true);

      if (exactResult.success && fuzzyResult.success) {
        // Exact matches should have higher scores
        expect(exactResult.data[0].score).toBeGreaterThan(
          fuzzyResult.data[0].score
        );
      }
    });
  });

  describe("error handling", () => {
    it("should handle invalid regex patterns gracefully", async () => {
      // This would be tested if we had regex support in the basic search
      const query: SearchQueryInterface = { text: "[invalid regex" };
      const result = await searchService.searchWithRanking(mockSnippets, query);

      expect(result.success).toBe(true); // Should not fail on invalid regex in text search
    });

    it("should handle empty snippet array", async () => {
      const query: SearchQueryInterface = { text: "react" };
      const result = await searchService.searchWithRanking([], query);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it("should handle malformed snippets gracefully", async () => {
      const malformedSnippet = {
        ...mockSnippets[0],
        tags: null as any, // Invalid tags
      };

      const query: SearchQueryInterface = { text: "react" };
      const result = await searchService.searchWithRanking(
        [malformedSnippet],
        query
      );

      expect(result.success).toBe(true); // Should handle gracefully
    });
  });
});
