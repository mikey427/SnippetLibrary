import { SearchQuery as ISearchQuery, Result, ErrorType } from "../../types";
import { createError } from "../utils";
import { validateSearchQuery } from "../validation";

/**
 * SearchQuery class with query building and validation
 */
export class SearchQuery implements ISearchQuery {
  public text?: string;
  public language?: string;
  public tags?: string[];
  public category?: string;
  public dateRange?: {
    start: Date;
    end: Date;
  };
  public sortBy?: "title" | "createdAt" | "usageCount";
  public sortOrder?: "asc" | "desc";

  constructor(query: Partial<ISearchQuery> = {}) {
    // Validate the query before creating
    const validation = validateSearchQuery(query);
    if (!validation.success) {
      throw new Error(`Invalid search query: ${validation.error.message}`);
    }

    this.text = query.text;
    this.language = query.language;
    this.tags = query.tags ? [...query.tags] : undefined;
    this.category = query.category;
    this.dateRange = query.dateRange
      ? {
          start: new Date(query.dateRange.start),
          end: new Date(query.dateRange.end),
        }
      : undefined;
    this.sortBy = query.sortBy;
    this.sortOrder = query.sortOrder;
  }

  /**
   * Create a new SearchQuery with text filter
   */
  static withText(text: string): SearchQuery {
    return new SearchQuery({ text });
  }

  /**
   * Create a new SearchQuery with language filter
   */
  static withLanguage(language: string): SearchQuery {
    return new SearchQuery({ language });
  }

  /**
   * Create a new SearchQuery with tags filter
   */
  static withTags(tags: string[]): SearchQuery {
    return new SearchQuery({ tags });
  }

  /**
   * Create a new SearchQuery with category filter
   */
  static withCategory(category: string): SearchQuery {
    return new SearchQuery({ category });
  }

  /**
   * Create a new SearchQuery with date range filter
   */
  static withDateRange(start: Date, end: Date): SearchQuery {
    return new SearchQuery({ dateRange: { start, end } });
  }

  /**
   * Validate the current query
   */
  validate(): Result<boolean> {
    return validateSearchQuery(this.toPlainObject());
  }

  /**
   * Add text filter to the query
   */
  addText(text: string): Result<SearchQuery> {
    const newQuery = this.clone();
    newQuery.text = text;

    const validation = newQuery.validate();
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      };
    }

    return { success: true, data: newQuery };
  }

  /**
   * Add language filter to the query
   */
  addLanguage(language: string): Result<SearchQuery> {
    const newQuery = this.clone();
    newQuery.language = language;

    const validation = newQuery.validate();
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      };
    }

    return { success: true, data: newQuery };
  }

  /**
   * Add tags filter to the query
   */
  addTags(tags: string[]): Result<SearchQuery> {
    const newQuery = this.clone();
    newQuery.tags = [...tags];

    const validation = newQuery.validate();
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      };
    }

    return { success: true, data: newQuery };
  }

  /**
   * Add category filter to the query
   */
  addCategory(category: string): Result<SearchQuery> {
    const newQuery = this.clone();
    newQuery.category = category;

    const validation = newQuery.validate();
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      };
    }

    return { success: true, data: newQuery };
  }

  /**
   * Add date range filter to the query
   */
  addDateRange(start: Date, end: Date): Result<SearchQuery> {
    if (start > end) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Start date must be before end date",
          { start, end },
          true,
          "Ensure the start date is before the end date"
        ),
      };
    }

    const newQuery = this.clone();
    newQuery.dateRange = { start, end };

    const validation = newQuery.validate();
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      };
    }

    return { success: true, data: newQuery };
  }

  /**
   * Set sorting options
   */
  setSorting(
    sortBy: "title" | "createdAt" | "usageCount",
    sortOrder: "asc" | "desc" = "asc"
  ): Result<SearchQuery> {
    const newQuery = this.clone();
    newQuery.sortBy = sortBy;
    newQuery.sortOrder = sortOrder;

    const validation = newQuery.validate();
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      };
    }

    return { success: true, data: newQuery };
  }

  /**
   * Clear all filters
   */
  clear(): SearchQuery {
    return new SearchQuery();
  }

  /**
   * Check if the query is empty (no filters applied)
   */
  isEmpty(): boolean {
    return (
      !this.text &&
      !this.language &&
      (!this.tags || this.tags.length === 0) &&
      !this.category &&
      !this.dateRange
    );
  }

  /**
   * Check if the query has any filters
   */
  hasFilters(): boolean {
    return !this.isEmpty();
  }

  /**
   * Get a summary of active filters
   */
  getFilterSummary(): string[] {
    const filters: string[] = [];

    if (this.text) filters.push(`text: "${this.text}"`);
    if (this.language) filters.push(`language: ${this.language}`);
    if (this.tags && this.tags.length > 0)
      filters.push(`tags: [${this.tags.join(", ")}]`);
    if (this.category) filters.push(`category: ${this.category}`);
    if (this.dateRange)
      filters.push(
        `date range: ${this.dateRange.start.toDateString()} - ${this.dateRange.end.toDateString()}`
      );
    if (this.sortBy)
      filters.push(`sort: ${this.sortBy} ${this.sortOrder || "asc"}`);

    return filters;
  }

  /**
   * Clone the current query
   */
  clone(): SearchQuery {
    return new SearchQuery(this.toPlainObject());
  }

  /**
   * Convert to plain object
   */
  toPlainObject(): ISearchQuery {
    return {
      text: this.text,
      language: this.language,
      tags: this.tags ? [...this.tags] : undefined,
      category: this.category,
      dateRange: this.dateRange
        ? {
            start: new Date(this.dateRange.start),
            end: new Date(this.dateRange.end),
          }
        : undefined,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
    };
  }

  /**
   * Convert to JSON string
   */
  toJSON(): ISearchQuery {
    return this.toPlainObject();
  }
}
