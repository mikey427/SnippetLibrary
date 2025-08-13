import { SnippetData, ErrorType, Result, SnippetError } from "../types";
import { isEmpty, createError } from "./utils";

/**
 * Validate snippet data
 */
export function validateSnippetData(data: SnippetData): Result<boolean> {
  const errors: string[] = [];

  // Validate title
  if (isEmpty(data.title)) {
    errors.push("Title is required");
  } else if (data.title.length > 100) {
    errors.push("Title must be 100 characters or less");
  }

  // Validate description
  if (data.description && data.description.length > 500) {
    errors.push("Description must be 500 characters or less");
  }

  // Validate code
  if (isEmpty(data.code)) {
    errors.push("Code is required");
  } else if (data.code.length > 50000) {
    errors.push("Code must be 50,000 characters or less");
  }

  // Validate language
  if (isEmpty(data.language)) {
    errors.push("Language is required");
  } else if (!/^[a-zA-Z0-9-_]+$/.test(data.language)) {
    errors.push(
      "Language must contain only alphanumeric characters, hyphens, and underscores"
    );
  }

  // Validate tags
  if (!Array.isArray(data.tags)) {
    errors.push("Tags must be an array");
  } else {
    if (data.tags.length > 20) {
      errors.push("Maximum 20 tags allowed");
    }
    for (const tag of data.tags) {
      if (typeof tag !== "string" || isEmpty(tag)) {
        errors.push("All tags must be non-empty strings");
        break;
      }
      if (tag.length > 50) {
        errors.push("Each tag must be 50 characters or less");
        break;
      }
    }
  }

  // Validate category
  if (data.category && data.category.length > 100) {
    errors.push("Category must be 100 characters or less");
  }

  // Validate prefix
  if (data.prefix) {
    if (data.prefix.length > 50) {
      errors.push("Prefix must be 50 characters or less");
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(data.prefix)) {
      errors.push(
        "Prefix must contain only alphanumeric characters, hyphens, and underscores"
      );
    }
  }

  // Validate scope
  if (data.scope) {
    if (!Array.isArray(data.scope)) {
      errors.push("Scope must be an array");
    } else if (data.scope.length > 10) {
      errors.push("Maximum 10 scope entries allowed");
    } else {
      for (const scope of data.scope) {
        if (typeof scope !== "string" || isEmpty(scope)) {
          errors.push("All scope entries must be non-empty strings");
          break;
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: createError(
        ErrorType.validation,
        "Snippet validation failed",
        { errors },
        true,
        "Please fix the validation errors and try again"
      ),
    };
  }

  return { success: true, data: true };
}

/**
 * Validate search query parameters
 */
export function validateSearchQuery(query: any): Result<boolean> {
  if (!query || typeof query !== "object") {
    return {
      success: false,
      error: createError(
        ErrorType.validation,
        "Search query must be an object",
        { query },
        true,
        "Provide a valid search query object"
      ),
    };
  }

  // Validate text search
  if (query.text !== undefined && typeof query.text !== "string") {
    return {
      success: false,
      error: createError(
        ErrorType.validation,
        "Search text must be a string",
        { text: query.text },
        true
      ),
    };
  }

  // Validate language filter
  if (query.language !== undefined && typeof query.language !== "string") {
    return {
      success: false,
      error: createError(
        ErrorType.validation,
        "Language filter must be a string",
        { language: query.language },
        true
      ),
    };
  }

  // Validate tags filter
  if (query.tags !== undefined && !Array.isArray(query.tags)) {
    return {
      success: false,
      error: createError(
        ErrorType.validation,
        "Tags filter must be an array",
        { tags: query.tags },
        true
      ),
    };
  }

  // Validate sort parameters
  if (query.sortBy !== undefined) {
    const validSortFields = ["title", "createdAt", "usageCount"];
    if (!validSortFields.includes(query.sortBy)) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          `Sort field must be one of: ${validSortFields.join(", ")}`,
          { sortBy: query.sortBy },
          true
        ),
      };
    }
  }

  if (query.sortOrder !== undefined) {
    const validSortOrders = ["asc", "desc"];
    if (!validSortOrders.includes(query.sortOrder)) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          `Sort order must be one of: ${validSortOrders.join(", ")}`,
          { sortOrder: query.sortOrder },
          true
        ),
      };
    }
  }

  return { success: true, data: true };
}
