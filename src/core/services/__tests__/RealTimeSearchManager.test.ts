import { RealTimeSearchManager, SearchEvent } from "../RealTimeSearchManager";
import { SearchService } from "../SearchService";
import { SnippetInterface, SearchQueryInterface } from "../../../types";
import { vi } from "vitest";

// Mock SearchService
vi.mock("../SearchService");

const createMockSnippet = (
  id: string,
  title: string,
  description: string,
  code: string,
  language: string,
  tags: string[] = []
): SnippetInterface => ({
  id,
  title,
  description,
  code,
  language,
  tags,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  usageCount: 0,
  prefix: `${language}_${title.toLowerCase().replace(/\s+/g, "_")}`,
  scope: [language],
});

const mockSnippets: SnippetInterface[] = [
  createMockSnippet(
    "1",
    "React Component",
    "A basic React functional component",
    "const Component = () => <div>Hello</div>;",
    "javascript",
    ["react", "component"]
  ),
  createMockSnippet(
    "2",
    "Python Function",
    "A simple Python function",
    "def hello(): print('Hello')",
    "python",
    ["function"]
  ),
];

describe("RealTimeSearchManager", () => {
  let searchManager: RealTimeSearchManager;
  let mockSearchService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockSearchService = {
      searchWithRanking: vi.fn(),
      getSearchSuggestions: vi.fn(),
    };

    mockSearchService.searchWithRanking.mockResolvedValue({
      success: true,
      data: [
        {
          snippet: mockSnippets[0],
          score: 1.0,
          matches: [],
        },
      ],
    });

    mockSearchService.getSearchSuggestions.mockResolvedValue({
      success: true,
      data: [
        {
          text: "react",
          type: "tag",
          frequency: 1,
        },
      ],
    });

    searchManager = new RealTimeSearchManager(mockSearchService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("debounced search", () => {
    it("should debounce search requests", async () => {
      const query: SearchQueryInterface = { text: "react" };

      // Make multiple rapid search requests
      searchManager.searchRealTime(mockSnippets, query);
      searchManager.searchRealTime(mockSnippets, query);
      searchManager.searchRealTime(mockSnippets, query);

      // Should not have called search service yet
      expect(mockSearchService.searchWithRanking).not.toHaveBeenCalled();

      // Fast-forward time to trigger debounced search
      vi.advanceTimersByTime(300);

      // Wait for async operations
      await Promise.resolve();

      // Should have called search service only once
      expect(mockSearchService.searchWithRanking).toHaveBeenCalledTimes(1);
      expect(mockSearchService.searchWithRanking).toHaveBeenCalledWith(
        mockSnippets,
        query
      );
    });

    it("should execute immediate search when requested", async () => {
      const query: SearchQueryInterface = { text: "react" };

      await searchManager.searchRealTime(mockSnippets, query, true);

      // Should have called search service immediately
      expect(mockSearchService.searchWithRanking).toHaveBeenCalledTimes(1);
    });

    it("should cancel pending search when new search is requested", async () => {
      const query1: SearchQueryInterface = { text: "react" };
      const query2: SearchQueryInterface = { text: "python" };

      searchManager.searchRealTime(mockSnippets, query1);
      searchManager.searchRealTime(mockSnippets, query2);

      vi.advanceTimersByTime(300);
      await Promise.resolve();

      // Should only execute the last search
      expect(mockSearchService.searchWithRanking).toHaveBeenCalledTimes(1);
      expect(mockSearchService.searchWithRanking).toHaveBeenCalledWith(
        mockSnippets,
        query2
      );
    });

    it("should allow canceling pending search", async () => {
      const query: SearchQueryInterface = { text: "react" };

      searchManager.searchRealTime(mockSnippets, query);
      searchManager.cancelPendingSearch();

      vi.advanceTimersByTime(300);
      await Promise.resolve();

      // Should not have executed any search
      expect(mockSearchService.searchWithRanking).not.toHaveBeenCalled();
    });
  });

  describe("debounce configuration", () => {
    it("should allow setting debounce delay", () => {
      searchManager.setDebounceDelay(500);
      expect(searchManager.getDebounceDelay()).toBe(500);
    });

    it("should not allow negative debounce delay", () => {
      searchManager.setDebounceDelay(-100);
      expect(searchManager.getDebounceDelay()).toBe(0);
    });

    it("should use custom debounce delay", async () => {
      searchManager.setDebounceDelay(100);
      const query: SearchQueryInterface = { text: "react" };

      searchManager.searchRealTime(mockSnippets, query);

      // Should not execute before custom delay
      vi.advanceTimersByTime(50);
      await Promise.resolve();
      expect(mockSearchService.searchWithRanking).not.toHaveBeenCalled();

      // Should execute after custom delay
      vi.advanceTimersByTime(50);
      await Promise.resolve();
      expect(mockSearchService.searchWithRanking).toHaveBeenCalledTimes(1);
    });
  });

  describe("search suggestions", () => {
    it("should debounce suggestion requests", async () => {
      const partialQuery = "rea";

      // Make multiple rapid suggestion requests
      searchManager.getSuggestionsRealTime(partialQuery, mockSnippets);
      searchManager.getSuggestionsRealTime(partialQuery, mockSnippets);

      // Should not have called search service yet
      expect(mockSearchService.getSearchSuggestions).not.toHaveBeenCalled();

      // Fast-forward time to trigger debounced suggestions
      vi.advanceTimersByTime(150); // Half of search debounce delay

      await Promise.resolve();

      // Should have called search service only once
      expect(mockSearchService.getSearchSuggestions).toHaveBeenCalledTimes(1);
    });

    it("should execute immediate suggestions when requested", async () => {
      const partialQuery = "rea";

      const result = await searchManager.getSuggestionsRealTime(
        partialQuery,
        mockSnippets,
        true
      );

      expect(result.success).toBe(true);
      expect(mockSearchService.getSearchSuggestions).toHaveBeenCalledTimes(1);
    });
  });

  describe("event listeners", () => {
    it("should notify listeners on search start", async () => {
      const startListener = vi.fn();
      searchManager.onSearchStart(startListener);

      const query: SearchQueryInterface = { text: "react" };
      await searchManager.searchRealTime(mockSnippets, query, true);

      expect(startListener).toHaveBeenCalledWith(query);
    });

    it("should notify listeners on search complete", async () => {
      const completeListener = vi.fn();
      searchManager.onSearchComplete(completeListener);

      const query: SearchQueryInterface = { text: "react" };
      await searchManager.searchRealTime(mockSnippets, query, true);

      expect(completeListener).toHaveBeenCalledTimes(1);
      const event: SearchEvent = completeListener.mock.calls[0][0];
      expect(event.query).toEqual(query);
      expect(event.results).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.duration).toBeGreaterThanOrEqual(0);
    });

    it("should notify listeners on search error", async () => {
      const errorListener = vi.fn();
      searchManager.onSearchError(errorListener);

      // Mock search service to return error
      mockSearchService.searchWithRanking.mockResolvedValue({
        success: false,
        error: {
          type: "unknown" as any,
          message: "Test error",
          details: {},
          recoverable: true,
        },
      });

      const query: SearchQueryInterface = { text: "react" };
      await searchManager.searchRealTime(mockSnippets, query, true);

      expect(errorListener).toHaveBeenCalledTimes(1);
    });

    it("should handle listener errors gracefully", async () => {
      const faultyListener = vi.fn(() => {
        throw new Error("Listener error");
      });
      const goodListener = vi.fn();

      searchManager.onSearchStart(faultyListener);
      searchManager.onSearchStart(goodListener);

      const query: SearchQueryInterface = { text: "react" };
      await searchManager.searchRealTime(mockSnippets, query, true);

      // Both listeners should have been called despite the error
      expect(faultyListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });

    it("should allow removing listeners", () => {
      const listener = vi.fn();
      searchManager.onSearchStart(listener);
      searchManager.removeListener("start", listener);

      const query: SearchQueryInterface = { text: "react" };
      searchManager.searchRealTime(mockSnippets, query, true);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("search metrics", () => {
    it("should track search performance metrics", async () => {
      const query: SearchQueryInterface = { text: "react" };

      // Perform multiple searches
      await searchManager.searchRealTime(mockSnippets, query, true);
      await searchManager.searchRealTime(mockSnippets, query, true);

      const metrics = searchManager.getSearchMetrics();

      expect(metrics.totalSearches).toBe(2);
      expect(metrics.averageSearchTime).toBeGreaterThanOrEqual(0);
      expect(metrics.slowestSearch).toBeGreaterThanOrEqual(0);
      expect(metrics.fastestSearch).toBeGreaterThanOrEqual(0);
      expect(metrics.lastSearchTime).toBeGreaterThanOrEqual(0);
    });

    it("should update fastest and slowest search times", async () => {
      const query: SearchQueryInterface = { text: "react" };

      // Mock different response times by resolving immediately vs with delay
      mockSearchService.searchWithRanking
        .mockResolvedValueOnce({
          success: true,
          data: [],
        })
        .mockResolvedValueOnce({
          success: true,
          data: [],
        });

      await searchManager.searchRealTime(mockSnippets, query, true);
      await searchManager.searchRealTime(mockSnippets, query, true);

      const metrics = searchManager.getSearchMetrics();
      expect(metrics.fastestSearch).toBeLessThanOrEqual(metrics.slowestSearch);
      expect(metrics.totalSearches).toBe(2);
    });

    it("should clear metrics when history is cleared", () => {
      searchManager.clearHistory();
      const metrics = searchManager.getSearchMetrics();

      expect(metrics.totalSearches).toBe(0);
      expect(metrics.averageSearchTime).toBe(0);
      expect(metrics.slowestSearch).toBe(0);
      expect(metrics.fastestSearch).toBe(Infinity);
      expect(metrics.lastSearchTime).toBe(0);
    });
  });

  describe("search history", () => {
    it("should track recent searches", async () => {
      const query1: SearchQueryInterface = { text: "react" };
      const query2: SearchQueryInterface = { text: "python" };

      await searchManager.searchRealTime(mockSnippets, query1, true);
      await searchManager.searchRealTime(mockSnippets, query2, true);

      const recentSearches = searchManager.getRecentSearches();

      expect(recentSearches).toHaveLength(2);
      expect(recentSearches[0].query).toEqual(query2); // Most recent first
      expect(recentSearches[1].query).toEqual(query1);
    });

    it("should limit recent searches", async () => {
      const query: SearchQueryInterface = { text: "test" };

      // Perform more searches than the limit
      for (let i = 0; i < 15; i++) {
        await searchManager.searchRealTime(
          mockSnippets,
          { ...query, text: `test${i}` },
          true
        );
      }

      const recentSearches = searchManager.getRecentSearches(5);
      expect(recentSearches).toHaveLength(5);
    });

    it("should clear search history", async () => {
      const query: SearchQueryInterface = { text: "react" };
      await searchManager.searchRealTime(mockSnippets, query, true);

      searchManager.clearHistory();
      const recentSearches = searchManager.getRecentSearches();

      expect(recentSearches).toHaveLength(0);
    });
  });

  describe("integration", () => {
    it("should provide access to underlying search service", () => {
      const service = searchManager.getSearchService();
      expect(service).toBe(mockSearchService);
    });

    it("should handle concurrent search requests", async () => {
      const query1: SearchQueryInterface = { text: "react" };
      const query2: SearchQueryInterface = { text: "python" };

      // Start multiple searches concurrently
      const promise1 = searchManager.searchRealTime(mockSnippets, query1, true);
      const promise2 = searchManager.searchRealTime(mockSnippets, query2, true);

      await Promise.all([promise1, promise2]);

      // Both searches should complete
      expect(mockSearchService.searchWithRanking).toHaveBeenCalledTimes(2);
    });
  });

  describe("performance", () => {
    it("should handle rapid search requests efficiently", async () => {
      const query: SearchQueryInterface = { text: "react" };

      // Make many rapid requests
      for (let i = 0; i < 100; i++) {
        searchManager.searchRealTime(mockSnippets, query);
      }

      vi.advanceTimersByTime(300);
      await Promise.resolve();

      // Should only execute one search due to debouncing
      expect(mockSearchService.searchWithRanking).toHaveBeenCalledTimes(1);
    });

    it("should maintain reasonable memory usage", async () => {
      const query: SearchQueryInterface = { text: "test" };

      // Perform many searches to test memory management
      for (let i = 0; i < 100; i++) {
        await searchManager.searchRealTime(
          mockSnippets,
          { ...query, text: `test${i}` },
          true
        );
      }

      const recentSearches = searchManager.getRecentSearches();
      const metrics = searchManager.getSearchMetrics();

      // Should maintain reasonable limits
      expect(recentSearches.length).toBeLessThanOrEqual(50);
      expect(metrics.totalSearches).toBe(100);
    });
  });
});
