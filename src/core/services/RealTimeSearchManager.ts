import {
  SnippetInterface,
  SearchQueryInterface,
  Result,
  ErrorType,
} from "../../types";
import { SearchService, SearchResult, SearchSuggestion } from "./SearchService";
import { createError } from "../utils";

/**
 * Real-time search event
 */
export interface SearchEvent {
  query: SearchQueryInterface;
  results: SearchResult[];
  timestamp: Date;
  duration: number;
}

/**
 * Search performance metrics
 */
export interface SearchMetrics {
  totalSearches: number;
  averageSearchTime: number;
  slowestSearch: number;
  fastestSearch: number;
  lastSearchTime: number;
}

/**
 * Real-time search manager with debouncing and performance tracking
 */
export class RealTimeSearchManager {
  private searchService: SearchService;
  private searchTimeout: NodeJS.Timeout | null = null;
  private debounceDelay: number = 300; // milliseconds
  private searchMetrics: SearchMetrics = {
    totalSearches: 0,
    averageSearchTime: 0,
    slowestSearch: 0,
    fastestSearch: Infinity,
    lastSearchTime: 0,
  };
  private searchHistory: SearchEvent[] = [];
  private maxHistorySize = 50;

  // Event listeners
  private onSearchStartListeners: Array<(query: SearchQueryInterface) => void> =
    [];
  private onSearchCompleteListeners: Array<(event: SearchEvent) => void> = [];
  private onSearchErrorListeners: Array<(error: any) => void> = [];

  constructor(searchService?: SearchService) {
    this.searchService = searchService || new SearchService();
  }

  /**
   * Perform real-time search with debouncing
   */
  async searchRealTime(
    snippets: SnippetInterface[],
    query: SearchQueryInterface,
    immediate: boolean = false
  ): Promise<void> {
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }

    // If immediate search is requested, execute right away
    if (immediate) {
      await this.executeSearch(snippets, query);
      return;
    }

    // Otherwise, debounce the search
    this.searchTimeout = setTimeout(async () => {
      await this.executeSearch(snippets, query);
    }, this.debounceDelay);
  }

  /**
   * Get search suggestions with debouncing
   */
  async getSuggestionsRealTime(
    partialQuery: string,
    snippets: SnippetInterface[],
    immediate: boolean = false
  ): Promise<Result<SearchSuggestion[]>> {
    if (immediate) {
      return this.searchService.getSearchSuggestions(partialQuery, snippets);
    }

    return new Promise((resolve) => {
      // Clear existing timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

      this.searchTimeout = setTimeout(async () => {
        const result = await this.searchService.getSearchSuggestions(
          partialQuery,
          snippets
        );
        resolve(result);
      }, this.debounceDelay / 2); // Faster debounce for suggestions
    });
  }

  /**
   * Cancel any pending search operations
   */
  cancelPendingSearch(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
  }

  /**
   * Set debounce delay
   */
  setDebounceDelay(delay: number): void {
    this.debounceDelay = Math.max(0, delay);
  }

  /**
   * Get current debounce delay
   */
  getDebounceDelay(): number {
    return this.debounceDelay;
  }

  /**
   * Get search performance metrics
   */
  getSearchMetrics(): SearchMetrics {
    return { ...this.searchMetrics };
  }

  /**
   * Get recent search history
   */
  getRecentSearches(limit: number = 10): SearchEvent[] {
    return this.searchHistory.slice(-limit).reverse();
  }

  /**
   * Clear search history and metrics
   */
  clearHistory(): void {
    this.searchHistory = [];
    this.searchMetrics = {
      totalSearches: 0,
      averageSearchTime: 0,
      slowestSearch: 0,
      fastestSearch: Infinity,
      lastSearchTime: 0,
    };
  }

  /**
   * Add event listener for search start
   */
  onSearchStart(listener: (query: SearchQueryInterface) => void): void {
    this.onSearchStartListeners.push(listener);
  }

  /**
   * Add event listener for search complete
   */
  onSearchComplete(listener: (event: SearchEvent) => void): void {
    this.onSearchCompleteListeners.push(listener);
  }

  /**
   * Add event listener for search error
   */
  onSearchError(listener: (error: any) => void): void {
    this.onSearchErrorListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeListener(
    type: "start" | "complete" | "error",
    listener: Function
  ): void {
    switch (type) {
      case "start":
        this.onSearchStartListeners = this.onSearchStartListeners.filter(
          (l) => l !== listener
        );
        break;
      case "complete":
        this.onSearchCompleteListeners = this.onSearchCompleteListeners.filter(
          (l) => l !== listener
        );
        break;
      case "error":
        this.onSearchErrorListeners = this.onSearchErrorListeners.filter(
          (l) => l !== listener
        );
        break;
    }
  }

  /**
   * Get search service instance
   */
  getSearchService(): SearchService {
    return this.searchService;
  }

  /**
   * Execute the actual search operation
   */
  private async executeSearch(
    snippets: SnippetInterface[],
    query: SearchQueryInterface
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Notify listeners that search is starting
      this.onSearchStartListeners.forEach((listener) => {
        try {
          listener(query);
        } catch (error) {
          console.warn("Error in search start listener:", error);
        }
      });

      // Perform the search
      const searchResult = await this.searchService.searchWithRanking(
        snippets,
        query
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (searchResult.success) {
        // Create search event
        const searchEvent: SearchEvent = {
          query: { ...query },
          results: searchResult.data,
          timestamp: new Date(),
          duration,
        };

        // Update metrics
        this.updateMetrics(duration);

        // Add to history
        this.addToHistory(searchEvent);

        // Notify listeners
        this.onSearchCompleteListeners.forEach((listener) => {
          try {
            listener(searchEvent);
          } catch (error) {
            console.warn("Error in search complete listener:", error);
          }
        });
      } else {
        // Handle search error
        this.onSearchErrorListeners.forEach((listener) => {
          try {
            listener(searchResult.error);
          } catch (error) {
            console.warn("Error in search error listener:", error);
          }
        });
      }
    } catch (error) {
      // Handle unexpected errors
      this.onSearchErrorListeners.forEach((listener) => {
        try {
          listener(error);
        } catch (listenerError) {
          console.warn("Error in search error listener:", listenerError);
        }
      });
    }
  }

  /**
   * Update search performance metrics
   */
  private updateMetrics(duration: number): void {
    this.searchMetrics.totalSearches++;
    this.searchMetrics.lastSearchTime = duration;

    // Update average
    this.searchMetrics.averageSearchTime =
      (this.searchMetrics.averageSearchTime *
        (this.searchMetrics.totalSearches - 1) +
        duration) /
      this.searchMetrics.totalSearches;

    // Update extremes
    this.searchMetrics.slowestSearch = Math.max(
      this.searchMetrics.slowestSearch,
      duration
    );
    this.searchMetrics.fastestSearch = Math.min(
      this.searchMetrics.fastestSearch,
      duration
    );
  }

  /**
   * Add search event to history
   */
  private addToHistory(event: SearchEvent): void {
    this.searchHistory.push(event);

    // Maintain history size limit
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory = this.searchHistory.slice(-this.maxHistorySize);
    }
  }
}

/**
 * Factory function to create a configured real-time search manager
 */
export function createRealTimeSearchManager(
  debounceDelay: number = 300
): RealTimeSearchManager {
  const manager = new RealTimeSearchManager();
  manager.setDebounceDelay(debounceDelay);
  return manager;
}
