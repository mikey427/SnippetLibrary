/**
 * Shared core library exports
 * This module provides the business logic that can be shared between
 * the VS Code extension and the web GUI
 */

// Export all types
export * from "../types";

// Export all interfaces
export * from "../interfaces/SnippetManager";
export * from "../interfaces/StorageService";

// Export utility functions
export * from "./utils";
export * from "./validation";
