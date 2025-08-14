import {
  SnippetInterface,
  SnippetData,
  SearchQueryInterface,
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
  createSnippet(snippet: SnippetData): Promise<Result<SnippetInterface>>;

  /**
   * Retrieve a snippet by ID
   */
  getSnippet(id: string): Promise<Result<SnippetInterface | null>>;

  /**
   * Update an existing snippet
   */
  updateSnippet(
    id: string,
    updates: Partial<SnippetData>
  ): Promise<Result<SnippetInterface>>;

  /**
   * Delete a snippet by ID
   */
  deleteSnippet(id: string): Promise<Result<boolean>>;

  /**
   * Get all snippets
   */
  getAllSnippets(): Promise<Result<SnippetInterface[]>>;

  /**
   * Search snippets based on query criteria
   */
  searchSnippets(
    query: SearchQueryInterface
  ): Promise<Result<SnippetInterface[]>>;

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
    Result<{
      totalSnippets: number;
      totalUsage: number;
      topUsed: SnippetInterface[];
    }>
  >;

  /**
   * Increment usage count for a snippet
   */
  incrementUsage(id: string): Promise<Result<void>>;
}
