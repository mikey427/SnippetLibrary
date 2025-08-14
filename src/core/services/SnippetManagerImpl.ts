import {
  SnippetInterface,
  SnippetData,
  SearchQueryInterface,
  ImportData,
  ImportResult,
  ExportData,
  ExportFilter,
  Result,
  ErrorType,
  ConflictResolution,
  StorageChange,
} from "../../types";
import { SnippetManager, UsageStatistics } from "./SnippetManager";
import { StorageService } from "./StorageService";
import { Snippet } from "../models/Snippet";
import { SearchQuery } from "../models/SearchQuery";
import { createError, generateId } from "../utils";

/**
 * Implementation of SnippetManager interface
 */
export class SnippetManagerImpl implements SnippetManager {
  private snippets: Map<string, Snippet> = new Map();
  private storageService: StorageService;
  private initialized = false;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  /**
   * Initialize the snippet manager
   */
  async initialize(): Promise<Result<void>> {
    try {
      // Initialize storage
      const initResult = await this.storageService.initialize();
      if (!initResult.success) {
        return initResult;
      }

      // Load snippets from storage
      const loadResult = await this.loadSnippetsFromStorage();
      if (!loadResult.success) {
        return {
          success: false,
          error: (loadResult as any).error,
        };
      }

      // Set up file watching
      const watchResult = this.storageService.watchChanges(
        this.handleStorageChanges.bind(this)
      );
      if (!watchResult.success) {
        // Log warning but don't fail initialization
        console.warn(
          "Failed to set up file watching:",
          (watchResult as any).error.message
        );
      }

      this.initialized = true;
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to initialize snippet manager",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check storage configuration and permissions"
        ),
      };
    }
  }

  /**
   * Create a new snippet
   */
  async createSnippet(data: SnippetData): Promise<Result<SnippetInterface>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      // Create new snippet instance
      const snippet = new Snippet(data);

      // Check for duplicate titles
      const existingSnippet = Array.from(this.snippets.values()).find(
        (s) => s.title === data.title
      );

      if (existingSnippet) {
        return {
          success: false,
          error: createError(
            ErrorType.validation,
            "Snippet with this title already exists",
            { title: data.title, existingId: existingSnippet.id },
            true,
            "Choose a different title or update the existing snippet"
          ),
        };
      }

      // Add to memory
      this.snippets.set(snippet.id, snippet);

      // Save to storage
      const saveResult = await this.saveSnippetsToStorage();
      if (!saveResult.success) {
        // Rollback memory change
        this.snippets.delete(snippet.id);
        return {
          success: false,
          error: (saveResult as any).error,
        };
      }

      return { success: true, data: snippet.toJSON() };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Failed to create snippet",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check snippet data and ensure all required fields are provided"
        ),
      };
    }
  }

  /**
   * Get a snippet by ID
   */
  async getSnippet(id: string): Promise<Result<SnippetInterface | null>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const snippet = this.snippets.get(id);
      return {
        success: true,
        data: snippet ? snippet.toJSON() : null,
      };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to get snippet",
          { id, error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Get all snippets
   */
  async getAllSnippets(): Promise<Result<SnippetInterface[]>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const snippets = Array.from(this.snippets.values()).map((s) =>
        s.toJSON()
      );
      return { success: true, data: snippets };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to get all snippets",
          { error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Update an existing snippet
   */
  async updateSnippet(
    id: string,
    updates: Partial<SnippetData>
  ): Promise<Result<SnippetInterface>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const snippet = this.snippets.get(id);
      if (!snippet) {
        return {
          success: false,
          error: createError(
            ErrorType.validation,
            "Snippet not found",
            { id },
            false,
            "Check the snippet ID and ensure it exists"
          ),
        };
      }

      // Check for title conflicts if title is being updated
      if (updates.title && updates.title !== snippet.title) {
        const existingSnippet = Array.from(this.snippets.values()).find(
          (s) => s.title === updates.title && s.id !== id
        );

        if (existingSnippet) {
          return {
            success: false,
            error: createError(
              ErrorType.validation,
              "Snippet with this title already exists",
              { title: updates.title, existingId: existingSnippet.id },
              true,
              "Choose a different title"
            ),
          };
        }
      }

      // Update the snippet
      const updateResult = snippet.update(updates);
      if (!updateResult.success) {
        return {
          success: false,
          error: (updateResult as any).error,
        };
      }

      // Save to storage
      const saveResult = await this.saveSnippetsToStorage();
      if (!saveResult.success) {
        return {
          success: false,
          error: (saveResult as any).error,
        };
      }

      return { success: true, data: snippet.toJSON() };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to update snippet",
          { id, error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Delete a snippet
   */
  async deleteSnippet(id: string): Promise<Result<boolean>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const snippet = this.snippets.get(id);
      if (!snippet) {
        return {
          success: false,
          error: createError(
            ErrorType.validation,
            "Snippet not found",
            { id },
            false,
            "Check the snippet ID and ensure it exists"
          ),
        };
      }

      // Remove from memory
      this.snippets.delete(id);

      // Save to storage
      const saveResult = await this.saveSnippetsToStorage();
      if (!saveResult.success) {
        // Rollback memory change
        this.snippets.set(id, snippet);
        return {
          success: false,
          error: (saveResult as any).error,
        };
      }

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to delete snippet",
          { id, error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }
  /**
   * Search snippets with query
   */
  async searchSnippets(
    query: SearchQueryInterface
  ): Promise<Result<SnippetInterface[]>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const searchQuery = new SearchQuery(query);
      let results = Array.from(this.snippets.values());

      // Apply filters
      if (searchQuery.text) {
        results = results.filter((snippet) =>
          snippet.matches(searchQuery.text!)
        );
      }

      if (searchQuery.language) {
        results = results.filter((snippet) =>
          snippet.hasLanguage(searchQuery.language!)
        );
      }

      if (searchQuery.tags && searchQuery.tags.length > 0) {
        results = results.filter((snippet) =>
          snippet.hasTags(searchQuery.tags!)
        );
      }

      if (searchQuery.category) {
        results = results.filter((snippet) =>
          snippet.hasCategory(searchQuery.category!)
        );
      }

      if (searchQuery.dateRange) {
        results = results.filter((snippet) => {
          const createdAt = snippet.createdAt;
          return (
            createdAt >= searchQuery.dateRange!.start &&
            createdAt <= searchQuery.dateRange!.end
          );
        });
      }

      // Apply sorting
      if (searchQuery.sortBy) {
        results.sort((a, b) => {
          let comparison = 0;

          switch (searchQuery.sortBy) {
            case "title":
              comparison = a.title.localeCompare(b.title);
              break;
            case "createdAt":
              comparison = a.createdAt.getTime() - b.createdAt.getTime();
              break;
            case "usageCount":
              comparison = a.usageCount - b.usageCount;
              break;
          }

          return searchQuery.sortOrder === "desc" ? -comparison : comparison;
        });
      }

      const snippetData = results.map((s) => s.toJSON());
      return { success: true, data: snippetData };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Failed to search snippets",
          { query, error: error instanceof Error ? error.message : error },
          true,
          "Check search query parameters"
        ),
      };
    }
  }

  /**
   * Import snippets from data
   */
  async importSnippets(data: ImportData): Promise<Result<ImportResult>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const result: ImportResult = {
        imported: 0,
        skipped: 0,
        errors: [],
        conflicts: [],
      };

      for (const snippetData of data.snippets) {
        try {
          // Check for existing snippet with same title
          const existingSnippet = Array.from(this.snippets.values()).find(
            (s) => s.title === snippetData.title
          );

          if (existingSnippet) {
            const conflict: ConflictResolution = {
              existingSnippet: existingSnippet.toJSON(),
              newSnippet: snippetData,
              resolution: data.conflictResolution,
            };

            switch (data.conflictResolution) {
              case "skip":
                result.skipped++;
                result.conflicts.push({ ...conflict, resolution: "skip" });
                continue;

              case "overwrite":
                const updateResult = await this.updateSnippet(
                  existingSnippet.id,
                  snippetData
                );
                if (updateResult.success) {
                  result.imported++;
                  result.conflicts.push({
                    ...conflict,
                    resolution: "overwrite",
                  });
                } else {
                  result.errors.push(
                    `Failed to overwrite snippet "${snippetData.title}": ${
                      (updateResult as any).error.message
                    }`
                  );
                }
                break;

              case "rename":
                let newTitle = snippetData.title;
                let counter = 1;
                while (
                  Array.from(this.snippets.values()).some(
                    (s) => s.title === newTitle
                  )
                ) {
                  newTitle = `${snippetData.title} (${counter})`;
                  counter++;
                }

                const createResult = await this.createSnippet({
                  ...snippetData,
                  title: newTitle,
                });

                if (createResult.success) {
                  result.imported++;
                  result.conflicts.push({
                    ...conflict,
                    resolution: "rename",
                    newName: newTitle,
                  });
                } else {
                  result.errors.push(
                    `Failed to create renamed snippet "${newTitle}": ${
                      (createResult as any).error.message
                    }`
                  );
                }
                break;
            }
          } else {
            // No conflict, create new snippet
            const createResult = await this.createSnippet(snippetData);
            if (createResult.success) {
              result.imported++;
            } else {
              result.errors.push(
                `Failed to create snippet "${snippetData.title}": ${
                  (createResult as any).error.message
                }`
              );
            }
          }
        } catch (error) {
          result.errors.push(
            `Error processing snippet "${snippetData.title}": ${
              error instanceof Error ? error.message : error
            }`
          );
        }
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to import snippets",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check import data format and try again"
        ),
      };
    }
  }

  /**
   * Export snippets with optional filter
   */
  async exportSnippets(filter?: ExportFilter): Promise<Result<ExportData>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      let snippets = Array.from(this.snippets.values());

      // Apply filters if provided
      if (filter) {
        if (filter.languages && filter.languages.length > 0) {
          snippets = snippets.filter((snippet) =>
            filter.languages!.includes(snippet.language)
          );
        }

        if (filter.tags && filter.tags.length > 0) {
          snippets = snippets.filter((snippet) =>
            filter.tags!.some((tag) => snippet.tags.includes(tag))
          );
        }

        if (filter.categories && filter.categories.length > 0) {
          snippets = snippets.filter(
            (snippet) =>
              snippet.category && filter.categories!.includes(snippet.category)
          );
        }

        if (filter.dateRange) {
          snippets = snippets.filter((snippet) => {
            const createdAt = snippet.createdAt;
            return (
              createdAt >= filter.dateRange!.start &&
              createdAt <= filter.dateRange!.end
            );
          });
        }
      }

      const exportData: ExportData = {
        snippets: snippets.map((s) => s.toJSON()),
        metadata: {
          exportedAt: new Date(),
          version: "1.0.0",
          count: snippets.length,
        },
      };

      return { success: true, data: exportData };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to export snippets",
          { error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Increment usage count for a snippet
   */
  async incrementUsage(id: string): Promise<Result<void>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const snippet = this.snippets.get(id);
      if (!snippet) {
        return {
          success: false,
          error: createError(
            ErrorType.validation,
            "Snippet not found",
            { id },
            false,
            "Check the snippet ID and ensure it exists"
          ),
        };
      }

      snippet.incrementUsage();

      // Save to storage
      const saveResult = await this.saveSnippetsToStorage();
      if (!saveResult.success) {
        return {
          success: false,
          error: (saveResult as any).error,
        };
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to increment usage",
          { id, error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStatistics(): Promise<Result<UsageStatistics>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const snippets = Array.from(this.snippets.values());
      const totalSnippets = snippets.length;
      const totalUsage = snippets.reduce((sum, s) => sum + s.usageCount, 0);
      const averageUsage = totalSnippets > 0 ? totalUsage / totalSnippets : 0;

      // Most used snippets (top 10)
      const mostUsedSnippets = snippets
        .map((snippet) => ({
          snippet: snippet.toJSON(),
          usageCount: snippet.usageCount,
        }))
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10);

      // Language distribution
      const languageCounts = new Map<string, number>();
      snippets.forEach((snippet) => {
        const count = languageCounts.get(snippet.language) || 0;
        languageCounts.set(snippet.language, count + 1);
      });

      const languageDistribution = Array.from(languageCounts.entries())
        .map(([language, count]) => ({
          language,
          count,
          percentage: totalSnippets > 0 ? (count / totalSnippets) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Tag distribution
      const tagCounts = new Map<string, number>();
      snippets.forEach((snippet) => {
        snippet.tags.forEach((tag) => {
          const count = tagCounts.get(tag) || 0;
          tagCounts.set(tag, count + 1);
        });
      });

      const tagDistribution = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({
          tag,
          count,
          percentage: totalSnippets > 0 ? (count / totalSnippets) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Category distribution
      const categoryCounts = new Map<string, number>();
      snippets.forEach((snippet) => {
        if (snippet.category) {
          const count = categoryCounts.get(snippet.category) || 0;
          categoryCounts.set(snippet.category, count + 1);
        }
      });

      const categoryDistribution = Array.from(categoryCounts.entries())
        .map(([category, count]) => ({
          category,
          count,
          percentage: totalSnippets > 0 ? (count / totalSnippets) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Recently created (last 10)
      const recentlyCreated = snippets
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
        .map((s) => s.toJSON());

      // Recently updated (last 10)
      const recentlyUpdated = snippets
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 10)
        .map((s) => s.toJSON());

      const statistics: UsageStatistics = {
        totalSnippets,
        totalUsage,
        averageUsage,
        mostUsedSnippets,
        languageDistribution,
        tagDistribution,
        categoryDistribution,
        recentlyCreated,
        recentlyUpdated,
      };

      return { success: true, data: statistics };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to get usage statistics",
          { error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  } /**
   *
 Get snippets by language
   */
  async getSnippetsByLanguage(
    language: string
  ): Promise<Result<SnippetInterface[]>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const snippets = Array.from(this.snippets.values())
        .filter((snippet) => snippet.hasLanguage(language))
        .map((s) => s.toJSON());

      return { success: true, data: snippets };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to get snippets by language",
          { language, error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Get snippets by tags
   */
  async getSnippetsByTags(tags: string[]): Promise<Result<SnippetInterface[]>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const snippets = Array.from(this.snippets.values())
        .filter((snippet) => snippet.hasTags(tags))
        .map((s) => s.toJSON());

      return { success: true, data: snippets };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to get snippets by tags",
          { tags, error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Get snippets by category
   */
  async getSnippetsByCategory(
    category: string
  ): Promise<Result<SnippetInterface[]>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const snippets = Array.from(this.snippets.values())
        .filter((snippet) => snippet.hasCategory(category))
        .map((s) => s.toJSON());

      return { success: true, data: snippets };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to get snippets by category",
          { category, error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Get all unique languages
   */
  async getLanguages(): Promise<Result<string[]>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const languages = Array.from(
        new Set(Array.from(this.snippets.values()).map((s) => s.language))
      ).sort();

      return { success: true, data: languages };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to get languages",
          { error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Get all unique tags
   */
  async getTags(): Promise<Result<string[]>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const allTags = Array.from(this.snippets.values()).flatMap((s) => s.tags);
      const uniqueTags = Array.from(new Set(allTags)).sort();

      return { success: true, data: uniqueTags };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to get tags",
          { error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<Result<string[]>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const categories = Array.from(this.snippets.values())
        .map((s) => s.category)
        .filter((category): category is string => category !== undefined);

      const uniqueCategories = Array.from(new Set(categories)).sort();

      return { success: true, data: uniqueCategories };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to get categories",
          { error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Refresh snippets from storage
   */
  async refresh(): Promise<Result<void>> {
    if (!this.initialized) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Snippet manager not initialized",
          {},
          true,
          "Call initialize() before using the snippet manager"
        ),
      };
    }

    try {
      const loadResult = await this.loadSnippetsFromStorage();
      if (!loadResult.success) {
        return loadResult;
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.unknown,
          "Failed to refresh snippets",
          { error: error instanceof Error ? error.message : error },
          true
        ),
      };
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.storageService.stopWatching();
    this.storageService.dispose();
    this.snippets.clear();
    this.initialized = false;
  }

  // Private helper methods

  /**
   * Load snippets from storage into memory
   */
  private async loadSnippetsFromStorage(): Promise<Result<void>> {
    try {
      const loadResult = await this.storageService.loadSnippets();
      if (!loadResult.success) {
        return {
          success: false,
          error: (loadResult as any).error,
        };
      }

      // Clear existing snippets
      this.snippets.clear();

      // Convert to Snippet instances and add to memory
      for (const snippetData of loadResult.data) {
        try {
          const snippet = Snippet.fromExisting(snippetData);
          this.snippets.set(snippet.id, snippet);
        } catch (error) {
          console.warn(
            `Failed to load snippet ${snippetData.id}:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to load snippets from storage",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check storage configuration and permissions"
        ),
      };
    }
  }

  /**
   * Save snippets from memory to storage
   */
  private async saveSnippetsToStorage(): Promise<Result<void>> {
    try {
      const snippets = Array.from(this.snippets.values()).map((s) =>
        s.toJSON()
      );
      const saveResult = await this.storageService.saveSnippets(snippets);

      if (!saveResult.success) {
        return saveResult;
      }

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to save snippets to storage",
          { error: error instanceof Error ? error.message : error },
          true,
          "Check storage configuration and permissions"
        ),
      };
    }
  }

  /**
   * Handle storage changes from file watching
   */
  private handleStorageChanges(changes: StorageChange[]): void {
    // For now, just refresh from storage when changes are detected
    // In a more sophisticated implementation, we could merge changes
    this.refresh().catch((error) => {
      console.error("Failed to refresh snippets after storage change:", error);
    });
  }
}
