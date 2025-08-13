import { Snippet, SnippetData, ErrorType, SnippetError } from "../types";

/**
 * Generate a unique ID for snippets
 */
export function generateId(): string {
  return `snippet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a snippet object from snippet data
 */
export function createSnippetFromData(data: SnippetData): Snippet {
  const now = new Date();
  return {
    id: generateId(),
    title: data.title,
    description: data.description,
    code: data.code,
    language: data.language,
    tags: [...data.tags],
    category: data.category,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
    prefix: data.prefix,
    scope: data.scope ? [...data.scope] : undefined,
  };
}

/**
 * Update a snippet with new data
 */
export function updateSnippetWithData(
  snippet: Snippet,
  updates: Partial<SnippetData>
): Snippet {
  return {
    ...snippet,
    ...updates,
    id: snippet.id, // Preserve ID
    createdAt: snippet.createdAt, // Preserve creation date
    updatedAt: new Date(),
    usageCount: snippet.usageCount, // Preserve usage count
    tags: updates.tags ? [...updates.tags] : snippet.tags,
    scope: updates.scope ? [...updates.scope] : snippet.scope,
  };
}

/**
 * Create a structured error
 */
export function createError(
  type: ErrorType,
  message: string,
  details?: any,
  recoverable: boolean = true,
  suggestedAction?: string
): SnippetError {
  return {
    type,
    message,
    details,
    recoverable,
    suggestedAction,
  };
}

/**
 * Check if a string is empty or whitespace only
 */
export function isEmpty(str: string | undefined | null): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Sanitize a string for use as a filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Compare two arrays for equality
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((val, index) => val === b[index]);
}

/**
 * Remove duplicates from an array
 */
export function removeDuplicates<T>(array: T[]): T[] {
  return [...new Set(array)];
}
