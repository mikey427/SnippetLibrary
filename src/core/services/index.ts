// Export all service interfaces and implementations
export { StorageService } from "./StorageService";
export { FileSystemStorageService } from "./FileSystemStorageService";
export { SnippetManager, UsageStatistics } from "./SnippetManager";
export { SnippetManagerImpl } from "./SnippetManagerImpl";

// Export factory functions
import { FileSystemStorageService } from "./FileSystemStorageService";
import { StorageConfig as IStorageConfig } from "../../types";

/**
 * Create a storage service with optional configuration
 */
export function createStorageService(
  config?: Partial<IStorageConfig>
): FileSystemStorageService {
  return new FileSystemStorageService(config);
}

/**
 * Create a workspace-scoped storage service
 */
export function createWorkspaceStorageService(
  customPath?: string
): FileSystemStorageService {
  const config: Partial<IStorageConfig> = {
    location: "workspace",
    format: "json",
    autoBackup: true,
  };

  if (customPath) {
    config.path = customPath.endsWith(".json")
      ? customPath
      : `${customPath}/snippets.json`;
  }

  return new FileSystemStorageService(config);
}

/**
 * Create a global storage service
 */
export function createGlobalStorageService(): FileSystemStorageService {
  return new FileSystemStorageService({
    location: "global",
    format: "json",
    autoBackup: true,
  });
}
