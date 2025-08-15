import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  SnippetInterface,
  SnippetData,
  ImportData,
  ImportResult,
  ExportData,
  ExportFilter,
  Result,
  ErrorType,
  ConflictResolution,
} from "../../types";
import { SnippetManager } from "../../interfaces";
import { createError } from "../utils";

/**
 * File format for import/export operations
 */
export type FileFormat = "json" | "yaml";

/**
 * Export options with file format specification
 */
export interface ExportOptions {
  format: FileFormat;
  filePath: string;
  filter?: ExportFilter;
  includeMetadata?: boolean;
}

/**
 * Import options with conflict resolution
 */
export interface ImportOptions {
  filePath: string;
  conflictResolution: "skip" | "overwrite" | "rename";
  validateFormat?: boolean;
}

/**
 * Backup options
 */
export interface BackupOptions {
  format: FileFormat;
  includeTimestamp?: boolean;
  customPath?: string;
}

/**
 * Service for handling import/export operations with multiple file formats
 */
export class ImportExportService {
  private snippetManager: SnippetManager;

  constructor(snippetManager: SnippetManager) {
    this.snippetManager = snippetManager;
  }

  /**
   * Export snippets to a file with specified format
   */
  async exportToFile(options: ExportOptions): Promise<Result<string>> {
    try {
      // Get snippets from manager
      const exportResult = await this.snippetManager.exportSnippets(
        options.filter
      );

      if (!exportResult.success) {
        return {
          success: false,
          error: (exportResult as any).error,
        };
      }

      const exportData = exportResult.data;

      // Prepare data for export
      const dataToExport = options.includeMetadata
        ? exportData
        : { snippets: exportData.snippets };

      // Convert to specified format
      const fileContent = this.serializeData(dataToExport, options.format);
      if (!fileContent.success) {
        return fileContent;
      }

      // Ensure directory exists
      const dir = path.dirname(options.filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(options.filePath, fileContent.data, "utf-8");

      return {
        success: true,
        data: options.filePath,
      };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to export snippets to file",
          {
            filePath: options.filePath,
            format: options.format,
            error: error instanceof Error ? error.message : error,
          },
          true,
          "Check file path permissions and disk space"
        ),
      };
    }
  }

  /**
   * Import snippets from a file
   */
  async importFromFile(options: ImportOptions): Promise<Result<ImportResult>> {
    try {
      // Check if file exists
      try {
        await fs.access(options.filePath);
      } catch {
        return {
          success: false,
          error: createError(
            ErrorType.storageAccess,
            "Import file not found",
            { filePath: options.filePath },
            false,
            "Check the file path and ensure the file exists"
          ),
        };
      }

      // Read file content
      const fileContent = await fs.readFile(options.filePath, "utf-8");

      // Detect format from file extension
      const format = this.detectFileFormat(options.filePath);

      // Parse file content
      const parseResult = this.parseData(fileContent, format);
      if (!parseResult.success) {
        return {
          success: false,
          error: (parseResult as any).error,
        };
      }

      const parsedData = parseResult.data;

      // Validate data structure
      const validationResult = this.validateImportData(parsedData);
      if (!validationResult.success) {
        return {
          success: false,
          error: (validationResult as any).error,
        };
      }

      // Prepare import data
      const importData: ImportData = {
        snippets: parsedData.snippets || parsedData, // Handle both wrapped and unwrapped formats
        conflictResolution: options.conflictResolution,
      };

      // Import through snippet manager
      return await this.snippetManager.importSnippets(importData);
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to import snippets from file",
          {
            filePath: options.filePath,
            error: error instanceof Error ? error.message : error,
          },
          true,
          "Check file format and content structure"
        ),
      };
    }
  }

  /**
   * Create a backup of all snippets
   */
  async createBackup(options: BackupOptions): Promise<Result<string>> {
    try {
      // Generate backup file path
      const backupPath = this.generateBackupPath(options);

      // Export all snippets to backup file
      const exportOptions: ExportOptions = {
        format: options.format,
        filePath: backupPath,
        includeMetadata: true,
      };

      const exportResult = await this.exportToFile(exportOptions);
      if (!exportResult.success) {
        return {
          success: false,
          error: (exportResult as any).error,
        };
      }

      return {
        success: true,
        data: backupPath,
      };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.storageAccess,
          "Failed to create backup",
          {
            error: error instanceof Error ? error.message : error,
          },
          true,
          "Check backup directory permissions"
        ),
      };
    }
  }

  /**
   * Restore snippets from a backup file
   */
  async restoreFromBackup(backupPath: string): Promise<Result<ImportResult>> {
    const importOptions: ImportOptions = {
      filePath: backupPath,
      conflictResolution: "overwrite", // Backups should overwrite existing data
      validateFormat: true,
    };

    return await this.importFromFile(importOptions);
  }

  /**
   * Get supported file formats
   */
  getSupportedFormats(): FileFormat[] {
    return ["json", "yaml"];
  }

  /**
   * Validate if a file format is supported
   */
  isFormatSupported(format: string): format is FileFormat {
    return this.getSupportedFormats().includes(format as FileFormat);
  }

  /**
   * Detect file format from file extension
   */
  private detectFileFormat(filePath: string): FileFormat {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case ".yaml":
      case ".yml":
        return "yaml";
      case ".json":
      default:
        return "json";
    }
  }

  /**
   * Serialize data to specified format
   */
  private serializeData(data: any, format: FileFormat): Result<string> {
    try {
      switch (format) {
        case "json":
          return {
            success: true,
            data: JSON.stringify(data, null, 2),
          };
        case "yaml":
          return {
            success: true,
            data: yaml.dump(data, { indent: 2 }),
          };
        default:
          return {
            success: false,
            error: createError(
              ErrorType.validation,
              "Unsupported export format",
              { format },
              false,
              "Use 'json' or 'yaml' format"
            ),
          };
      }
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Failed to serialize data",
          {
            format,
            error: error instanceof Error ? error.message : error,
          },
          true,
          "Check data structure for serialization compatibility"
        ),
      };
    }
  }

  /**
   * Parse data from string content
   */
  private parseData(content: string, format: FileFormat): Result<any> {
    try {
      switch (format) {
        case "json":
          return {
            success: true,
            data: JSON.parse(content),
          };
        case "yaml":
          const yamlData = yaml.load(content);
          return {
            success: true,
            data: yamlData,
          };
        default:
          return {
            success: false,
            error: createError(
              ErrorType.validation,
              "Unsupported import format",
              { format },
              false,
              "Use 'json' or 'yaml' format"
            ),
          };
      }
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Failed to parse file content",
          {
            format,
            error: error instanceof Error ? error.message : error,
          },
          true,
          "Check file format and syntax"
        ),
      };
    }
  }

  /**
   * Validate import data structure
   */
  private validateImportData(data: any): Result<boolean> {
    try {
      // Handle both wrapped and unwrapped formats
      const snippets = data.snippets || data;

      if (!Array.isArray(snippets)) {
        return {
          success: false,
          error: createError(
            ErrorType.validation,
            "Invalid import data structure",
            { dataType: typeof snippets },
            false,
            "Import data must contain an array of snippets"
          ),
        };
      }

      // Validate each snippet has required fields
      for (let i = 0; i < snippets.length; i++) {
        const snippet = snippets[i];
        const requiredFields = ["title", "code", "language"];

        for (const field of requiredFields) {
          if (!snippet[field] || typeof snippet[field] !== "string") {
            return {
              success: false,
              error: createError(
                ErrorType.validation,
                `Invalid snippet at index ${i}`,
                { field, snippet },
                false,
                `Snippet must have a valid '${field}' field`
              ),
            };
          }
        }

        // Validate optional fields
        if (snippet.tags && !Array.isArray(snippet.tags)) {
          return {
            success: false,
            error: createError(
              ErrorType.validation,
              `Invalid tags at snippet index ${i}`,
              { tags: snippet.tags },
              false,
              "Tags must be an array of strings"
            ),
          };
        }
      }

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: createError(
          ErrorType.validation,
          "Failed to validate import data",
          {
            error: error instanceof Error ? error.message : error,
          },
          true,
          "Check data structure and format"
        ),
      };
    }
  }

  /**
   * Generate backup file path with timestamp
   */
  private generateBackupPath(options: BackupOptions): string {
    const timestamp = options.includeTimestamp
      ? new Date().toISOString().replace(/[:.]/g, "-")
      : "";

    const filename = timestamp
      ? `snippets-backup-${timestamp}.${options.format}`
      : `snippets-backup.${options.format}`;

    if (options.customPath) {
      return path.join(options.customPath, filename);
    }

    // Default to system temp directory
    return path.join(
      require("os").tmpdir(),
      "snippet-library-backups",
      filename
    );
  }
}
