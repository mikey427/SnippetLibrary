export { StorageService } from "./StorageService";
export { FileSystemStorageService } from "./FileSystemStorageService";

import { FileSystemStorageService } from "./FileSystemStorageService";
import { StorageService } from "./StorageService";
import { StorageConfig as IStorageConfig } from "../../types";

/**
 * Create a storage service instance
 */
export function createStorageService(
  config?: Partial<IStorageConfig>
): StorageService {
  return new FileSystemStorageService(config);
}

/**
 * Create a workspace storage service
 */
export function createWorkspaceStorageService(
  workspacePath?: string
): StorageService {
  const config: Partial<IStorageConfig> = {
    location: "workspace",
    format: "json",
    autoBackup: true,
    backupInterval: 3600000, // 1 hour
  };

  // If a workspace path is provided, construct the full path to snippets file
  if (workspacePath) {
    const path = require("path");
    config.path = path.join(
      workspacePath,
      ".vscode",
      "snippets",
      "snippets.json"
    );
  }

  return new FileSystemStorageService(config);
}

/**
 * Create a global storage service
 */
export function createGlobalStorageService(): StorageService {
  return new FileSystemStorageService({
    location: "global",
    format: "json",
    autoBackup: true,
    backupInterval: 3600000, // 1 hour
  });
}
