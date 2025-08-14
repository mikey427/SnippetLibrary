import {
  SnippetInterface,
  SnippetData,
  SearchQueryInterface,
  ImportData,
  ImportResult,
  ExportData,
  ExportFilter,
  Result,
} from "../../types";

/**
 * Interface for snippet manager operations
 */
export interface SnippetManager {
  /**
   * Create a new snippet
   */
  createSnippet(data: SnippetData): Promise<Result<SnippetInterface>>;

  /**
   * Get a snippet by ID
   */
  getSnippet(id: string): Promise<Result<SnippetInterface | null>>;

  /**
   * Get all snippets
   */
  getAllSnippets(): Promise<Result<SnippetInterface[]>>;

  /**
   * Update an existing snippet
   */
  updateSnippet(
    id: string,
    updates: Partial<SnippetData>
  ): Promise<Result<SnippetInterface>>;

  /**
   * Delete a snippet
   */
  deleteSnippet(id: string): Promise<Result<boolean>>;

  /**
   * Search snippets with query
   */
  searchSnippets(
    query: SearchQueryInterface
  ): Promise<Result<SnippetInterface[]>>;

  /**
   * Import snippets from data
   */
  importSnippets(data: ImportData): Promise<Result<ImportResult>>;

  /**
   * Export snippets with optional filter
   */
  exportSnippets(filter?: ExportFilter): Promise<Result<ExportData>>;

  /**
   * Increment usage count for a snippet
   */
  incrementUsage(id: string): Promise<Result<void>>;

  /**
   * Get usage statistics
   */
  getUsageStatistics(): Promise<Result<UsageStatistics>>;

  /**
   * Get snippets by language
   */
  getSnippetsByLanguage(language: string): Promise<Result<SnippetInterface[]>>;

  /**
   * Get snippets by tags
   */
  getSnippetsByTags(tags: string[]): Promise<Result<SnippetInterface[]>>;

  /**
   * Get snippets by category
   */
  getSnippetsByCategory(category: string): Promise<Result<SnippetInterface[]>>;

  /**
   * Get all unique languages
   */
  getLanguages(): Promise<Result<string[]>>;

  /**
   * Get all unique tags
   */
  getTags(): Promise<Result<string[]>>;

  /**
   * Get all unique categories
   */
  getCategories(): Promise<Result<string[]>>;

  /**
   * Refresh snippets from storage
   */
  refresh(): Promise<Result<void>>;

  /**
   * Initialize the snippet manager
   */
  initialize(): Promise<Result<void>>;

  /**
   * Clean up resources
   */
  dispose(): void;
}

/**
 * Usage statistics interface
 */
export interface UsageStatistics {
  totalSnippets: number;
  totalUsage: number;
  averageUsage: number;
  mostUsedSnippets: Array<{
    snippet: SnippetInterface;
    usageCount: number;
  }>;
  languageDistribution: Array<{
    language: string;
    count: number;
    percentage: number;
  }>;
  tagDistribution: Array<{
    tag: string;
    count: number;
    percentage: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  recentlyCreated: SnippetInterface[];
  recentlyUpdated: SnippetInterface[];
}
