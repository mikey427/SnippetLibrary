import {
  Snippet,
  SnippetData,
  SearchQuery,
  ImportData,
  ImportResult,
  ExportData,
  ExportFilter,
  Result,
} from "../types";

/**
 * Core interface for snippet management operations
 */
export interface SnippetManager {
  /**
   * Create a new snippet
   */
  createSnippet(snippet: SnippetData): Promise<Result<Snippet>>;

  /**
   * Retrieve a snippet by ID
   */
  getSnippet(id: string): Promise<Result<Snippet | null>>;

  /**
   * Update an existing snippet
   */
  updateSnippet(
    id: string,
    updates: Partial<SnippetData>
  ): Promise<Result<Snippet>>;

  /**
   * Delete a snippet by ID
   */
  deleteSnippet(id: string): Promise<Result<boolean>>;

  /**
   * Get all snippets
   */
  getAllSnippets(): Promise<Result<Snippet[]>>;

  /**
   * Search snippets based on query criteria
   */
  searchSnippets(query: SearchQuery): Promise<Result<Snippet[]>>;

  /**
   * Import snippets from external data
   */
  importSnippets(data: ImportData): Promise<Result<ImportResult>>;

  /**
   * Export snippets based on filter criteria
   */
  exportSnippets(filter?: ExportFilter): Promise<Result<ExportData>>;

  /**
   * Validate snippet data
   */
  validateSnippet(snippet: SnippetData): Result<boolean>;

  /**
   * Get snippet usage statistics
   */
  getUsageStats(): Promise<
    Result<{ totalSnippets: number; totalUsage: number; topUsed: Snippet[] }>
  >;

  /**
   * Increment usage count for a snippet
   */
  incrementUsage(id: string): Promise<Result<void>>;
}
