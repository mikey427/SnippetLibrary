import { SnippetInterface, SnippetData, Result, ErrorType } from "../../types";
import { generateId, createError } from "../utils";
import { validateSnippetData } from "../validation";

/**
 * Snippet class with validation methods
 */
export class Snippet implements SnippetInterface {
  public readonly id: string;
  public title: string;
  public description: string;
  public code: string;
  public language: string;
  public tags: string[];
  public category?: string;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public usageCount: number;
  public prefix?: string;
  public scope?: string[];

  constructor(data: SnippetData, id?: string) {
    // Validate the data before creating the snippet
    const validation = validateSnippetData(data);
    if (!validation.success) {
      throw new Error(
        `Invalid snippet data: ${(validation as any).error.message}`
      );
    }

    this.id = id || generateId();
    this.title = data.title;
    this.description = data.description;
    this.code = data.code;
    this.language = data.language;
    this.tags = [...data.tags];
    this.category = data.category;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.usageCount = 0;
    this.prefix = data.prefix;
    this.scope = data.scope ? [...data.scope] : undefined;
  }

  /**
   * Create a Snippet instance from existing snippet data (e.g., loaded from storage)
   */
  static fromExisting(snippet: SnippetInterface): Snippet {
    const instance = Object.create(Snippet.prototype);
    Object.assign(instance, snippet);
    return instance;
  }

  /**
   * Validate the current snippet data
   */
  validate(): Result<boolean> {
    return validateSnippetData(this.toSnippetData());
  }

  /**
   * Update the snippet with new data
   */
  update(updates: Partial<SnippetData>): Result<void> {
    // Create a temporary object with the updates to validate
    const updatedData = {
      ...this.toSnippetData(),
      ...updates,
    };

    const validation = validateSnippetData(updatedData);
    if (!validation.success) {
      return {
        success: false,
        error: (validation as any).error,
      };
    }

    // Apply the updates
    if (updates.title !== undefined) this.title = updates.title;
    if (updates.description !== undefined)
      this.description = updates.description;
    if (updates.code !== undefined) this.code = updates.code;
    if (updates.language !== undefined) this.language = updates.language;
    if (updates.tags !== undefined) this.tags = [...updates.tags];
    if (updates.category !== undefined) this.category = updates.category;
    if (updates.prefix !== undefined) this.prefix = updates.prefix;
    if (updates.scope !== undefined)
      this.scope = updates.scope ? [...updates.scope] : undefined;

    this.updatedAt = new Date();

    return { success: true, data: undefined };
  }

  /**
   * Increment usage count
   */
  incrementUsage(): void {
    this.usageCount++;
    this.updatedAt = new Date();
  }

  /**
   * Convert to SnippetData format
   */
  toSnippetData(): SnippetData {
    return {
      title: this.title,
      description: this.description,
      code: this.code,
      language: this.language,
      tags: [...this.tags],
      category: this.category,
      prefix: this.prefix,
      scope: this.scope ? [...this.scope] : undefined,
    };
  }

  /**
   * Convert to plain object (for serialization)
   */
  toJSON(): SnippetInterface {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      code: this.code,
      language: this.language,
      tags: [...this.tags],
      category: this.category,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      usageCount: this.usageCount,
      prefix: this.prefix,
      scope: this.scope ? [...this.scope] : undefined,
    };
  }

  /**
   * Check if snippet matches search criteria
   */
  matches(searchText: string): boolean {
    const text = searchText.toLowerCase();
    return (
      this.title.toLowerCase().includes(text) ||
      this.description.toLowerCase().includes(text) ||
      this.code.toLowerCase().includes(text) ||
      this.language.toLowerCase().includes(text) ||
      this.tags.some((tag) => tag.toLowerCase().includes(text)) ||
      (this.category ? this.category.toLowerCase().includes(text) : false)
    );
  }

  /**
   * Check if snippet has all specified tags
   */
  hasTags(tags: string[]): boolean {
    return tags.every((tag) => this.tags.includes(tag));
  }

  /**
   * Check if snippet belongs to specified category
   */
  hasCategory(category: string): boolean {
    return this.category === category;
  }

  /**
   * Check if snippet is for specified language
   */
  hasLanguage(language: string): boolean {
    return this.language === language;
  }
}
