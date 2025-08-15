import {
  SnippetInterface,
  SearchQueryInterface,
  Result,
  ErrorType,
} from "../../types";
import { createError } from "../utils";

/**
 * Search result with relevance score
 */
export interface SearchResult {
  snippet: SnippetInterface;
  score: number;
  matches: SearchMatch[];
}

/**
 * Information about where a match was found
 */
export interface SearchMatch {
  field: "title" | "description" | "code" | "tags" | "category";
  text: string;
  startIndex: number;
  endIndex: number;
  score: number;
}

/**
 * Search suggestion based on history and content
 */
export interface SearchSuggestion {
  text: string;
  type: "history" | "tag" | "language" | "category";
  frequency?: number;
}

/**
 * Search history entry
 */
export interface SearchHistoryEntry {
  query: SearchQueryInterface;
  timestamp: Date;
  resultCount: number;
}

/**
 * Advanced search service with fuzzy matching, ranking, and suggestions
 */
export class SearchService {
  private searchHistory: SearchHistoryEntry[] = [];
  private maxHistorySize = 100;

  /**
   * Perform fuzzy search on snippets with ranking
   */
  async searchWithRanking(
    snippets: SnippetInterface[],
    query: SearchQueryInterface
  ): Promise<Result<SearchResult[]>> {
    try {
      let results: SearchResult[] = [];

      // If no search criteria, return all snippets with default score
      if (this.isEmptyQuery(query)) {
        results = snippets.map((snippet) => ({
          snippet,
          score: 1.0,
          matches: [],
        }));
      } else {
        // Perform fuzzy search and scoring
        results = this.performFuzzySearch(snippets, query);
      }

      // Apply additional filters
      results = this.applyFilters(results, query);

      // Sort by relevance score and then by specified sort criteria
      results = this.sortResults(results, query);

      // Record search in history
      this.addToHistory(query, results.length);

      return { success: true, data: results };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to perform search",
          { query, error: error instanceof Error ? error.message : error },
          true,
          "Check search parameters and try again"
        ),
      };
    }
  }

  /**
   * Get search suggestions based on query and history
   */
  async getSearchSuggestions(
    partialQuery: string,
    snippets: SnippetInterface[]
  ): Promise<Result<SearchSuggestion[]>> {
    try {
      const suggestions: SearchSuggestion[] = [];
      const lowerQuery = partialQuery.toLowerCase();

      // History-based suggestions
      const historySuggestions = this.getHistorySuggestions(lowerQuery);
      suggestions.push(...historySuggestions);

      // Content-based suggestions
      const contentSuggestions = this.getContentSuggestions(
        lowerQuery,
        snippets
      );
      suggestions.push(...contentSuggestions);

      // Remove duplicates and sort by relevance
      const uniqueSuggestions = this.deduplicateAndRankSuggestions(suggestions);

      return { success: true, data: uniqueSuggestions.slice(0, 10) };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to get search suggestions",
          {
            partialQuery,
            error: error instanceof Error ? error.message : error,
          },
          true
        ),
      };
    }
  }

  /**
   * Get search history
   */
  getSearchHistory(): SearchHistoryEntry[] {
    return [...this.searchHistory].reverse(); // Most recent first
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.searchHistory = [];
  }

  /**
   * Get popular search terms from history
   */
  getPopularSearchTerms(limit: number = 10): string[] {
    const termCounts = new Map<string, number>();

    this.searchHistory.forEach((entry) => {
      if (entry.query.text) {
        const term = entry.query.text.toLowerCase();
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      }
    });

    return Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term]) => term);
  }

  /**
   * Perform fuzzy search with scoring
   */
  private performFuzzySearch(
    snippets: SnippetInterface[],
    query: SearchQueryInterface
  ): SearchResult[] {
    const results: SearchResult[] = [];

    for (const snippet of snippets) {
      const searchResult = this.scoreSnippet(snippet, query);
      if (searchResult.score > 0) {
        results.push(searchResult);
      }
    }

    return results;
  }

  /**
   * Score a snippet against search query
   */
  private scoreSnippet(
    snippet: SnippetInterface,
    query: SearchQueryInterface
  ): SearchResult {
    let totalScore = 0;
    const matches: SearchMatch[] = [];

    // Text search with fuzzy matching
    if (query.text) {
      const textMatches = this.findTextMatches(snippet, query.text);
      matches.push(...textMatches);
      totalScore += textMatches.reduce((sum, match) => sum + match.score, 0);
    }

    // Exact matches get bonus points
    if (query.language && snippet.language === query.language) {
      totalScore += 2.0;
    }

    if (query.category && snippet.category === query.category) {
      totalScore += 1.5;
    }

    // Tag matches
    if (query.tags && query.tags.length > 0) {
      const tagMatches = query.tags.filter((tag) =>
        snippet.tags.some((snippetTag) =>
          snippetTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
      totalScore += tagMatches.length * 1.0;
    }

    // Usage count bonus (popular snippets get slight boost)
    totalScore += Math.log(snippet.usageCount + 1) * 0.1;

    // Recency bonus (newer snippets get slight boost)
    const daysSinceCreated =
      (Date.now() - snippet.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    totalScore += Math.max(0, (30 - daysSinceCreated) / 30) * 0.2;

    return {
      snippet,
      score: totalScore,
      matches,
    };
  }

  /**
   * Find text matches in snippet fields
   */
  private findTextMatches(
    snippet: SnippetInterface,
    searchText: string
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const lowerSearchText = searchText.toLowerCase();

    // Search in title (highest weight)
    const titleMatches = this.findMatches(
      snippet.title,
      lowerSearchText,
      "title",
      3.0
    );
    matches.push(...titleMatches);

    // Search in description (medium weight)
    const descMatches = this.findMatches(
      snippet.description,
      lowerSearchText,
      "description",
      2.0
    );
    matches.push(...descMatches);

    // Search in code (lower weight but important)
    const codeMatches = this.findMatches(
      snippet.code,
      lowerSearchText,
      "code",
      1.5
    );
    matches.push(...codeMatches);

    // Search in tags (medium weight)
    if (snippet.tags && Array.isArray(snippet.tags)) {
      const tagText = snippet.tags.join(" ");
      const tagMatches = this.findMatches(
        tagText,
        lowerSearchText,
        "tags",
        2.0
      );
      matches.push(...tagMatches);
    }

    // Search in category (medium weight)
    if (snippet.category) {
      const categoryMatches = this.findMatches(
        snippet.category,
        lowerSearchText,
        "category",
        2.0
      );
      matches.push(...categoryMatches);
    }

    return matches;
  }

  /**
   * Find matches in a text field with fuzzy matching
   */
  private findMatches(
    text: string,
    searchText: string,
    field: SearchMatch["field"],
    baseScore: number
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const lowerText = text.toLowerCase();

    // Exact match (highest score)
    let index = lowerText.indexOf(searchText);
    while (index !== -1) {
      matches.push({
        field,
        text: text.substring(index, index + searchText.length),
        startIndex: index,
        endIndex: index + searchText.length,
        score: baseScore * 1.0,
      });
      index = lowerText.indexOf(searchText, index + 1);
    }

    // Word boundary matches (high score)
    const wordBoundaryRegex = new RegExp(
      `\\b${this.escapeRegex(searchText)}`,
      "gi"
    );
    let match: RegExpExecArray | null;
    while ((match = wordBoundaryRegex.exec(text)) !== null) {
      // Avoid duplicates from exact matches
      if (!matches.some((m) => m.startIndex === match!.index)) {
        matches.push({
          field,
          text: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          score: baseScore * 0.8,
        });
      }
    }

    // Fuzzy matches for longer search terms
    if (searchText.length > 3) {
      const fuzzyMatches = this.findFuzzyMatches(
        text,
        searchText,
        field,
        baseScore * 0.5
      );
      matches.push(...fuzzyMatches);
    }

    return matches;
  }

  /**
   * Find fuzzy matches using simple character-based similarity
   */
  private findFuzzyMatches(
    text: string,
    searchText: string,
    field: SearchMatch["field"],
    baseScore: number
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const words = text.toLowerCase().split(/\s+/);
    const searchLower = searchText.toLowerCase();

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const similarity = this.calculateSimilarity(word, searchLower);

      if (similarity > 0.6) {
        // Find the word position in original text
        const wordStart = text.toLowerCase().indexOf(word);
        if (wordStart !== -1) {
          matches.push({
            field,
            text: text.substring(wordStart, wordStart + word.length),
            startIndex: wordStart,
            endIndex: wordStart + word.length,
            score: baseScore * similarity,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0
      ? 1
      : 1 - matrix[str2.length][str1.length] / maxLength;
  }

  /**
   * Apply additional filters to search results
   */
  private applyFilters(
    results: SearchResult[],
    query: SearchQueryInterface
  ): SearchResult[] {
    let filtered = results;

    if (query.language) {
      filtered = filtered.filter(
        (result) => result.snippet.language === query.language
      );
    }

    if (query.category) {
      filtered = filtered.filter(
        (result) => result.snippet.category === query.category
      );
    }

    if (query.tags && query.tags.length > 0) {
      filtered = filtered.filter((result) =>
        query.tags!.every((tag) =>
          result.snippet.tags.some((snippetTag) =>
            snippetTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }

    if (query.dateRange) {
      filtered = filtered.filter((result) => {
        const createdAt = result.snippet.createdAt;
        return (
          createdAt >= query.dateRange!.start &&
          createdAt <= query.dateRange!.end
        );
      });
    }

    return filtered;
  }

  /**
   * Sort search results by relevance and specified criteria
   */
  private sortResults(
    results: SearchResult[],
    query: SearchQueryInterface
  ): SearchResult[] {
    return results.sort((a, b) => {
      // Primary sort by relevance score (descending)
      if (Math.abs(a.score - b.score) > 0.01) {
        return b.score - a.score;
      }

      // Secondary sort by specified criteria
      if (query.sortBy) {
        let comparison = 0;

        switch (query.sortBy) {
          case "title":
            comparison = a.snippet.title.localeCompare(b.snippet.title);
            break;
          case "createdAt":
            comparison =
              a.snippet.createdAt.getTime() - b.snippet.createdAt.getTime();
            break;
          case "usageCount":
            comparison = a.snippet.usageCount - b.snippet.usageCount;
            break;
        }

        if (query.sortOrder === "desc") {
          comparison = -comparison;
        }

        if (comparison !== 0) {
          return comparison;
        }
      }

      // Tertiary sort by usage count (descending)
      return b.snippet.usageCount - a.snippet.usageCount;
    });
  }

  /**
   * Check if query is empty
   */
  private isEmptyQuery(query: SearchQueryInterface): boolean {
    return (
      !query.text &&
      !query.language &&
      !query.category &&
      (!query.tags || query.tags.length === 0) &&
      !query.dateRange
    );
  }

  /**
   * Add search to history
   */
  private addToHistory(query: SearchQueryInterface, resultCount: number): void {
    // Don't add empty queries to history
    if (this.isEmptyQuery(query)) {
      return;
    }

    const entry: SearchHistoryEntry = {
      query: { ...query },
      timestamp: new Date(),
      resultCount,
    };

    this.searchHistory.push(entry);

    // Maintain history size limit
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory = this.searchHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get suggestions from search history
   */
  private getHistorySuggestions(partialQuery: string): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const termCounts = new Map<string, number>();

    // Count frequency of matching terms in history
    this.searchHistory.forEach((entry) => {
      if (
        entry.query.text &&
        entry.query.text.toLowerCase().includes(partialQuery)
      ) {
        const term = entry.query.text;
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      }
    });

    // Convert to suggestions
    termCounts.forEach((frequency, text) => {
      suggestions.push({
        text,
        type: "history",
        frequency,
      });
    });

    return suggestions;
  }

  /**
   * Get suggestions from snippet content
   */
  private getContentSuggestions(
    partialQuery: string,
    snippets: SnippetInterface[]
  ): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const tagCounts = new Map<string, number>();
    const languageCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();

    snippets.forEach((snippet) => {
      // Tag suggestions
      snippet.tags.forEach((tag) => {
        if (tag.toLowerCase().includes(partialQuery)) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      });

      // Language suggestions
      if (snippet.language.toLowerCase().includes(partialQuery)) {
        languageCounts.set(
          snippet.language,
          (languageCounts.get(snippet.language) || 0) + 1
        );
      }

      // Category suggestions
      if (
        snippet.category &&
        snippet.category.toLowerCase().includes(partialQuery)
      ) {
        categoryCounts.set(
          snippet.category,
          (categoryCounts.get(snippet.category) || 0) + 1
        );
      }
    });

    // Convert to suggestions
    tagCounts.forEach((frequency, text) => {
      suggestions.push({ text, type: "tag", frequency });
    });

    languageCounts.forEach((frequency, text) => {
      suggestions.push({ text, type: "language", frequency });
    });

    categoryCounts.forEach((frequency, text) => {
      suggestions.push({ text, type: "category", frequency });
    });

    return suggestions;
  }

  /**
   * Remove duplicates and rank suggestions
   */
  private deduplicateAndRankSuggestions(
    suggestions: SearchSuggestion[]
  ): SearchSuggestion[] {
    const uniqueMap = new Map<string, SearchSuggestion>();

    suggestions.forEach((suggestion) => {
      const existing = uniqueMap.get(suggestion.text);
      if (
        !existing ||
        (suggestion.frequency || 0) > (existing.frequency || 0)
      ) {
        uniqueMap.set(suggestion.text, suggestion);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      // Sort by frequency (descending), then by type priority
      const freqDiff = (b.frequency || 0) - (a.frequency || 0);
      if (freqDiff !== 0) return freqDiff;

      // Type priority: history > tag > language > category
      const typePriority = { history: 4, tag: 3, language: 2, category: 1 };
      return typePriority[b.type] - typePriority[a.type];
    });
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
