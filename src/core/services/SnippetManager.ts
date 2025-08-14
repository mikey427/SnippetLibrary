import {
  Snippet,
  SnippetData,
  SearchQuery,
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
  createSnippet(data: SnippetData): Promise<Result<Snippet>>;

  /**
   * Get a snippet by ID
   */
  getSnippet(id: string): Promise<Result<Snippet | null>>;

  /**
   * Get all snippets
   */
  getAllSnippets(): Promise<Result<Snippet[]>>;

  /**
   * Update an existing snippet
   */
  updateSnippet(
    id: string,
    updates: Partial<SnippetData>
  ): Promise<Result<Snippet>>;

  /**
   * Delete a snippet
   */
  deleteSnippet(id: string): Promise<Result<boolean>>;

  /**
   * Search snippets with query
   */
  searchSnippets(query: SearchQuery): Promise<Result<Snippet[]>>;

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
  getSnippetsByLanguage(language: string): Promise<Result<Snippet[]>>;

  /**
   * Get snippets by tags
   */
  getSnippetsByTags(tags: string[]): Promise<Result<Snippet[]>>;

  /**
   * Get snippets by category
   */
  getSnippetsByCategory(category: string): Promise<Result<Snippet[]>>;

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
    snippet: Snippet;
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
  recentlyCreated: Snippet[];
  recentlyUpdated: Snippet[];
}
