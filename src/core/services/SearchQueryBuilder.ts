import { SearchQueryInterface, Result, ErrorType } from "../../types";
import { SearchQuery } from "../models/SearchQuery";
import { createError } from "../utils";

/**
 * Advanced search filter
 */
export interface AdvancedSearchFilter {
  field: "title" | "description" | "code" | "tags" | "category" | "language";
  operator: "contains" | "equals" | "startsWith" | "endsWith" | "regex" | "not";
  value: string;
  caseSensitive?: boolean;
}

/**
 * Search query with advanced filters
 */
export interface AdvancedSearchQuery extends SearchQueryInterface {
  filters?: AdvancedSearchFilter[];
  operator?: "and" | "or"; // How to combine filters
}

/**
 * Saved search query
 */
export interface SavedSearch {
  id: string;
  name: string;
  query: AdvancedSearchQuery;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
}

// Global saved searches storage (in a real implementation, this would be persisted)
const globalSavedSearches: Map<string, SavedSearch> = new Map();

/**
 * Search query builder for creating complex search queries
 */
export class SearchQueryBuilder {
  private query: AdvancedSearchQuery = {};
  private savedSearches: Map<string, SavedSearch> = globalSavedSearches;

  /**
   * Create a new query builder
   */
  static create(): SearchQueryBuilder {
    return new SearchQueryBuilder();
  }

  /**
   * Set text search
   */
  withText(text: string): SearchQueryBuilder {
    this.query.text = text;
    return this;
  }

  /**
   * Set language filter
   */
  withLanguage(language: string): SearchQueryBuilder {
    this.query.language = language;
    return this;
  }

  /**
   * Set tags filter
   */
  withTags(tags: string[]): SearchQueryBuilder {
    this.query.tags = [...tags];
    return this;
  }

  /**
   * Add a single tag
   */
  addTag(tag: string): SearchQueryBuilder {
    if (!this.query.tags) {
      this.query.tags = [];
    }
    if (!this.query.tags.includes(tag)) {
      this.query.tags.push(tag);
    }
    return this;
  }

  /**
   * Set category filter
   */
  withCategory(category: string): SearchQueryBuilder {
    this.query.category = category;
    return this;
  }

  /**
   * Set date range filter
   */
  withDateRange(start: Date, end: Date): SearchQueryBuilder {
    this.query.dateRange = { start, end };
    return this;
  }

  /**
   * Set date range from string dates
   */
  withDateRangeString(startDate: string, endDate: string): SearchQueryBuilder {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date format");
    }

    return this.withDateRange(start, end);
  }

  /**
   * Set date range for last N days
   */
  withLastDays(days: number): SearchQueryBuilder {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return this.withDateRange(start, end);
  }

  /**
   * Set sorting
   */
  sortBy(
    field: "title" | "createdAt" | "usageCount",
    order: "asc" | "desc" = "asc"
  ): SearchQueryBuilder {
    this.query.sortBy = field;
    this.query.sortOrder = order;
    return this;
  }

  /**
   * Add advanced filter
   */
  addFilter(filter: AdvancedSearchFilter): SearchQueryBuilder {
    if (!this.query.filters) {
      this.query.filters = [];
    }
    this.query.filters.push(filter);
    return this;
  }

  /**
   * Add contains filter
   */
  contains(
    field: AdvancedSearchFilter["field"],
    value: string,
    caseSensitive: boolean = false
  ): SearchQueryBuilder {
    return this.addFilter({
      field,
      operator: "contains",
      value,
      caseSensitive,
    });
  }

  /**
   * Add equals filter
   */
  equals(
    field: AdvancedSearchFilter["field"],
    value: string,
    caseSensitive: boolean = false
  ): SearchQueryBuilder {
    return this.addFilter({
      field,
      operator: "equals",
      value,
      caseSensitive,
    });
  }

  /**
   * Add starts with filter
   */
  startsWith(
    field: AdvancedSearchFilter["field"],
    value: string,
    caseSensitive: boolean = false
  ): SearchQueryBuilder {
    return this.addFilter({
      field,
      operator: "startsWith",
      value,
      caseSensitive,
    });
  }

  /**
   * Add ends with filter
   */
  endsWith(
    field: AdvancedSearchFilter["field"],
    value: string,
    caseSensitive: boolean = false
  ): SearchQueryBuilder {
    return this.addFilter({
      field,
      operator: "endsWith",
      value,
      caseSensitive,
    });
  }

  /**
   * Add regex filter
   */
  regex(
    field: AdvancedSearchFilter["field"],
    pattern: string,
    caseSensitive: boolean = false
  ): SearchQueryBuilder {
    return this.addFilter({
      field,
      operator: "regex",
      value: pattern,
      caseSensitive,
    });
  }

  /**
   * Add not filter
   */
  not(
    field: AdvancedSearchFilter["field"],
    value: string,
    caseSensitive: boolean = false
  ): SearchQueryBuilder {
    return this.addFilter({
      field,
      operator: "not",
      value,
      caseSensitive,
    });
  }

  /**
   * Set filter combination operator
   */
  combineWith(operator: "and" | "or"): SearchQueryBuilder {
    this.query.operator = operator;
    return this;
  }

  /**
   * Build the search query
   */
  build(): Result<AdvancedSearchQuery> {
    try {
      // Validate the query
      const validation = this.validate();
      if (!validation.success) {
        return validation;
      }

      return {
        success: true,
        data: { ...this.query },
      };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Failed to build search query",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check query parameters and try again"
        ),
      };
    }
  }

  /**
   * Build as SearchQuery instance
   */
  buildAsSearchQuery(): Result<SearchQuery> {
    const buildResult = this.build();
    if (!buildResult.success) {
      return buildResult as any;
    }

    try {
      const searchQuery = new SearchQuery(buildResult.data);
      return { success: true, data: searchQuery };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Failed to create SearchQuery instance",
          { error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Reset the builder
   */
  reset(): SearchQueryBuilder {
    this.query = {};
    return this;
  }

  /**
   * Clone the current builder
   */
  clone(): SearchQueryBuilder {
    const newBuilder = new SearchQueryBuilder();
    newBuilder.query = JSON.parse(JSON.stringify(this.query));
    return newBuilder;
  }

  /**
   * Load query from existing query object
   */
  fromQuery(query: SearchQueryInterface): SearchQueryBuilder {
    this.query = { ...query };
    return this;
  }

  /**
   * Save current query with a name
   */
  saveAs(name: string): Result<SavedSearch> {
    try {
      const buildResult = this.build();
      if (!buildResult.success) {
        return buildResult as any;
      }

      const savedSearch: SavedSearch = {
        id: this.generateId(),
        name,
        query: buildResult.data,
        createdAt: new Date(),
        lastUsed: new Date(),
        useCount: 0,
      };

      this.savedSearches.set(savedSearch.id, savedSearch);

      return { success: true, data: savedSearch };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to save search query",
          { name, error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Load saved search by ID
   */
  loadSaved(id: string): Result<SearchQueryBuilder> {
    const savedSearch = this.savedSearches.get(id);
    if (!savedSearch) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Saved search not found",
          { id },
          false,
          "Check the saved search ID"
        ),
      };
    }

    // Update usage statistics
    savedSearch.lastUsed = new Date();
    savedSearch.useCount++;

    // Load the query
    this.fromQuery(savedSearch.query);

    return { success: true, data: this };
  }

  /**
   * Get all saved searches
   */
  getSavedSearches(): SavedSearch[] {
    return Array.from(this.savedSearches.values()).sort(
      (a, b) => b.lastUsed.getTime() - a.lastUsed.getTime()
    );
  }

  /**
   * Delete saved search
   */
  deleteSaved(id: string): Result<boolean> {
    const deleted = this.savedSearches.delete(id);
    if (!deleted) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Saved search not found",
          { id },
          false
        ),
      };
    }

    return { success: true, data: true };
  }

  /**
   * Get query summary as human-readable string
   */
  getSummary(): string {
    const parts: string[] = [];

    if (this.query.text) {
      parts.push(`text: "${this.query.text}"`);
    }

    if (this.query.language) {
      parts.push(`language: ${this.query.language}`);
    }

    if (this.query.tags && this.query.tags.length > 0) {
      parts.push(`tags: [${this.query.tags.join(", ")}]`);
    }

    if (this.query.category) {
      parts.push(`category: ${this.query.category}`);
    }

    if (this.query.dateRange) {
      parts.push(
        `date: ${this.query.dateRange.start.toDateString()} - ${this.query.dateRange.end.toDateString()}`
      );
    }

    if (this.query.filters && this.query.filters.length > 0) {
      const filterSummaries = this.query.filters.map(
        (f) => `${f.field} ${f.operator} "${f.value}"`
      );
      parts.push(`filters: [${filterSummaries.join(", ")}]`);
    }

    if (this.query.sortBy) {
      parts.push(`sort: ${this.query.sortBy} ${this.query.sortOrder || "asc"}`);
    }

    return parts.length > 0 ? parts.join(", ") : "empty query";
  }

  /**
   * Validate the current query
   */
  private validate(): Result<boolean> {
    try {
      // Validate date range
      if (this.query.dateRange) {
        if (this.query.dateRange.start > this.query.dateRange.end) {
          return {
            success: false,
            error: createError(
              ErrorType.validation,
              "Start date must be before end date",
              { dateRange: this.query.dateRange },
              true
            ),
          };
        }
      }

      // Validate regex filters
      if (this.query.filters) {
        for (const filter of this.query.filters) {
          if (filter.operator === "regex") {
            try {
              new RegExp(filter.value);
            } catch (error) {
              return {
                success: false,
                error: createError(
                  ErrorType.validation,
                  "Invalid regex pattern",
                  { pattern: filter.value, error },
                  true,
                  "Check the regex pattern syntax"
                ),
              };
            }
          }
        }
      }

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Query validation failed",
          { error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Generate unique ID for saved searches
   */
  private generateId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Utility functions for common search patterns
 */
export class SearchPatterns {
  /**
   * Search for recently created snippets
   */
  static recentlyCreated(days: number = 7): SearchQueryBuilder {
    return SearchQueryBuilder.create()
      .withLastDays(days)
      .sortBy("createdAt", "desc");
  }

  /**
   * Search for most used snippets
   */
  static mostUsed(limit?: number): SearchQueryBuilder {
    const builder = SearchQueryBuilder.create().sortBy("usageCount", "desc");
    return builder;
  }

  /**
   * Search for snippets by programming language
   */
  static byLanguage(language: string): SearchQueryBuilder {
    return SearchQueryBuilder.create().withLanguage(language);
  }

  /**
   * Search for snippets with specific tags
   */
  static withTags(...tags: string[]): SearchQueryBuilder {
    return SearchQueryBuilder.create().withTags(tags);
  }

  /**
   * Search for unused snippets
   */
  static unused(): SearchQueryBuilder {
    return SearchQueryBuilder.create()
      .addFilter({
        field: "code", // This is a placeholder - we'd need usage count field
        operator: "equals",
        value: "0",
      })
      .sortBy("createdAt", "desc");
  }

  /**
   * Full text search across all fields
   */
  static fullText(searchText: string): SearchQueryBuilder {
    return SearchQueryBuilder.create()
      .withText(searchText)
      .combineWith("or")
      .contains("title", searchText)
      .contains("description", searchText)
      .contains("code", searchText);
  }
}
