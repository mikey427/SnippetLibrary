import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import {
  ImportExportService,
  ExportOptions,
  ImportOptions,
} from "../ImportExportService";
import { SnippetManager } from "../../../interfaces";
import { SnippetInterface, ExportData, ImportResult } from "../../../types";

// Mock fs module
vi.mock("fs/promises");

describe("ImportExportService - File Format Compatibility", () => {
  let importExportService: ImportExportService;
  let mockSnippetManager: SnippetManager;

  const sampleSnippets: SnippetInterface[] = [
    {
      id: "1",
      title: "React Component",
      description: "Basic React functional component",
      code: `import React from 'react';

const MyComponent = () => {
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  );
};

export default MyComponent;`,
      language: "javascript",
      tags: ["react", "component", "jsx"],
      category: "frontend",
      createdAt: new Date("2023-01-01T10:00:00Z"),
      updatedAt: new Date("2023-01-02T15:30:00Z"),
      usageCount: 10,
      prefix: "rfc",
      scope: ["javascript", "typescript", "jsx", "tsx"],
    },
    {
      id: "2",
      title: "Python Class",
      description: "Basic Python class with constructor",
      code: `class MyClass:
    def __init__(self, name):
        self.name = name
    
    def greet(self):
        return f"Hello, {self.name}!"`,
      language: "python",
      tags: ["python", "class", "oop"],
      createdAt: new Date("2023-01-03T09:15:00Z"),
      updatedAt: new Date("2023-01-03T09:15:00Z"),
      usageCount: 5,
    },
    {
      id: "3",
      title: "SQL Query",
      description: "Select with JOIN",
      code: `SELECT u.name, p.title
FROM users u
INNER JOIN posts p ON u.id = p.user_id
WHERE u.active = 1
ORDER BY p.created_at DESC;`,
      language: "sql",
      tags: ["sql", "join", "query"],
      category: "database",
      createdAt: new Date("2023-01-04T14:20:00Z"),
      updatedAt: new Date("2023-01-04T14:20:00Z"),
      usageCount: 3,
    },
  ];

  const mockExportData: ExportData = {
    snippets: sampleSnippets,
    metadata: {
      exportedAt: new Date("2023-01-05T12:00:00Z"),
      version: "1.0.0",
      count: 3,
    },
  };

  beforeEach(() => {
    // Create mock snippet manager
    mockSnippetManager = {
      createSnippet: vi.fn(),
      getSnippet: vi.fn(),
      updateSnippet: vi.fn(),
      deleteSnippet: vi.fn(),
      getAllSnippets: vi.fn(),
      searchSnippets: vi.fn(),
      importSnippets: vi.fn(),
      exportSnippets: vi.fn(),
      validateSnippet: vi.fn(),
      getUsageStats: vi.fn(),
      incrementUsage: vi.fn(),
    };

    importExportService = new ImportExportService(mockSnippetManager);

    // Setup default mocks
    vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
      success: true,
      data: mockExportData,
    });

    vi.mocked(mockSnippetManager.importSnippets).mockResolvedValue({
      success: true,
      data: {
        imported: 3,
        skipped: 0,
        errors: [],
        conflicts: [],
      },
    });

    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("JSON Format Export/Import Cycle", () => {
    it("should maintain data integrity through JSON export/import cycle", async () => {
      const exportPath = "/tmp/test-export.json";
      const exportOptions: ExportOptions = {
        format: "json",
        filePath: exportPath,
        includeMetadata: true,
      };

      // Export to JSON
      const exportResult = await importExportService.exportToFile(
        exportOptions
      );
      expect(exportResult.success).toBe(true);

      // Capture the JSON content that would be written
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const jsonContent = writeCall[1] as string;
      const parsedData = JSON.parse(jsonContent);

      // Verify JSON structure
      expect(parsedData).toHaveProperty("snippets");
      expect(parsedData).toHaveProperty("metadata");
      expect(parsedData.snippets).toHaveLength(3);
      expect(parsedData.metadata.count).toBe(3);

      // Verify snippet data preservation
      const firstSnippet = parsedData.snippets[0];
      expect(firstSnippet.title).toBe("React Component");
      expect(firstSnippet.code).toContain("import React");
      expect(firstSnippet.tags).toEqual(["react", "component", "jsx"]);
      expect(firstSnippet.scope).toEqual([
        "javascript",
        "typescript",
        "jsx",
        "tsx",
      ]);

      // Mock reading the file for import
      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);

      // Import from JSON
      const importOptions: ImportOptions = {
        filePath: exportPath,
        conflictResolution: "skip",
      };

      const importResult = await importExportService.importFromFile(
        importOptions
      );
      expect(importResult.success).toBe(true);

      // Verify import was called with correct data
      const importCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[0][0];
      expect(importCall.snippets).toHaveLength(3);
      expect(importCall.snippets[0].title).toBe("React Component");
    });

    it("should handle special characters and unicode in JSON", async () => {
      const specialSnippet: SnippetInterface = {
        id: "special",
        title: "Special Characters: 中文 🚀 \"quotes\" 'apostrophes'",
        description: "Contains unicode, emojis, and quotes",
        code: `// Special characters test
const message = "Hello 世界! 🌍";
const path = 'C:\\Users\\test\\file.txt';
console.log(\`Template: \${message}\`);`,
        language: "javascript",
        tags: ["unicode", "special-chars", "测试"],
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
        usageCount: 1,
      };

      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: true,
        data: {
          snippets: [specialSnippet],
          metadata: {
            exportedAt: new Date(),
            version: "1.0.0",
            count: 1,
          },
        },
      });

      const exportOptions: ExportOptions = {
        format: "json",
        filePath: "/tmp/special.json",
        includeMetadata: true,
      };

      const exportResult = await importExportService.exportToFile(
        exportOptions
      );
      expect(exportResult.success).toBe(true);

      const jsonContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      const parsedData = JSON.parse(jsonContent);

      expect(parsedData.snippets[0].title).toBe(
        "Special Characters: 中文 🚀 \"quotes\" 'apostrophes'"
      );
      expect(parsedData.snippets[0].code).toContain("Hello 世界! 🌍");
      expect(parsedData.snippets[0].tags).toContain("测试");
    });
  });

  describe("YAML Format Export/Import Cycle", () => {
    it("should maintain data integrity through YAML export/import cycle", async () => {
      const exportPath = "/tmp/test-export.yaml";
      const exportOptions: ExportOptions = {
        format: "yaml",
        filePath: exportPath,
        includeMetadata: true,
      };

      // Export to YAML
      const exportResult = await importExportService.exportToFile(
        exportOptions
      );
      expect(exportResult.success).toBe(true);

      // Capture the YAML content that would be written
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const yamlContent = writeCall[1] as string;

      // Verify YAML structure
      expect(yamlContent).toContain("snippets:");
      expect(yamlContent).toContain("metadata:");
      expect(yamlContent).toContain("- id: '1'");
      expect(yamlContent).toContain("title: React Component");

      // Mock reading the file for import
      vi.mocked(fs.readFile).mockResolvedValue(yamlContent);

      // Import from YAML
      const importOptions: ImportOptions = {
        filePath: exportPath,
        conflictResolution: "skip",
      };

      const importResult = await importExportService.importFromFile(
        importOptions
      );
      expect(importResult.success).toBe(true);

      // Verify import was called with correct data
      const importCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[0][0];
      expect(importCall.snippets).toHaveLength(3);
      expect(importCall.snippets[0].title).toBe("React Component");
    });

    it("should handle multiline code blocks in YAML", async () => {
      const multilineSnippet: SnippetInterface = {
        id: "multiline",
        title: "Multiline Code",
        description: "Code with multiple lines and indentation",
        code: `function complexFunction() {
  if (condition) {
    return {
      key: 'value',
      nested: {
        array: [1, 2, 3],
        string: "with quotes"
      }
    };
  }
  
  // Comment with special chars: @#$%^&*()
  return null;
}`,
        language: "javascript",
        tags: ["multiline", "complex"],
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
        usageCount: 1,
      };

      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: true,
        data: {
          snippets: [multilineSnippet],
          metadata: {
            exportedAt: new Date(),
            version: "1.0.0",
            count: 1,
          },
        },
      });

      const exportOptions: ExportOptions = {
        format: "yaml",
        filePath: "/tmp/multiline.yaml",
        includeMetadata: true,
      };

      const exportResult = await importExportService.exportToFile(
        exportOptions
      );
      expect(exportResult.success).toBe(true);

      const yamlContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(yamlContent).toContain("function complexFunction()");
      expect(yamlContent).toContain("// Comment with special chars");

      // Mock reading and importing
      vi.mocked(fs.readFile).mockResolvedValue(yamlContent);

      const importOptions: ImportOptions = {
        filePath: "/tmp/multiline.yaml",
        conflictResolution: "skip",
      };

      const importResult = await importExportService.importFromFile(
        importOptions
      );
      expect(importResult.success).toBe(true);

      const importCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[0][0];
      expect(importCall.snippets[0].code).toContain(
        "function complexFunction()"
      );
      expect(importCall.snippets[0].code).toContain(
        "// Comment with special chars"
      );
    });
  });

  describe("Cross-Format Compatibility", () => {
    it("should import JSON data exported as YAML", async () => {
      // First export as JSON
      const jsonExportOptions: ExportOptions = {
        format: "json",
        filePath: "/tmp/export.json",
        includeMetadata: false,
      };

      await importExportService.exportToFile(jsonExportOptions);
      const jsonContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      const jsonData = JSON.parse(jsonContent);

      // Then export the same data as YAML
      const yamlExportOptions: ExportOptions = {
        format: "yaml",
        filePath: "/tmp/export.yaml",
        includeMetadata: false,
      };

      await importExportService.exportToFile(yamlExportOptions);
      const yamlContent = vi.mocked(fs.writeFile).mock.calls[1][1] as string;

      // Import both and verify they produce the same result
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(jsonContent)
        .mockResolvedValueOnce(yamlContent);

      const jsonImportResult = await importExportService.importFromFile({
        filePath: "/tmp/export.json",
        conflictResolution: "skip",
      });

      const yamlImportResult = await importExportService.importFromFile({
        filePath: "/tmp/export.yaml",
        conflictResolution: "skip",
      });

      expect(jsonImportResult.success).toBe(true);
      expect(yamlImportResult.success).toBe(true);

      // Both should call importSnippets with equivalent data
      const jsonImportCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[0][0];
      const yamlImportCall = vi.mocked(mockSnippetManager.importSnippets).mock
        .calls[1][0];

      expect(jsonImportCall.snippets).toHaveLength(
        yamlImportCall.snippets.length
      );
      expect(jsonImportCall.snippets[0].title).toBe(
        yamlImportCall.snippets[0].title
      );
    });
  });

  describe("Large Dataset Handling", () => {
    it("should handle large number of snippets", async () => {
      // Create a large dataset
      const largeDataset: SnippetInterface[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          id: `snippet-${i}`,
          title: `Snippet ${i}`,
          description: `Description for snippet ${i}`,
          code: `// Code for snippet ${i}\nconsole.log('Snippet ${i}');`,
          language: i % 2 === 0 ? "javascript" : "python",
          tags: [`tag-${i % 10}`, `category-${i % 5}`],
          category: `category-${i % 3}`,
          createdAt: new Date(2023, 0, (i % 30) + 1),
          updatedAt: new Date(2023, 0, (i % 30) + 1),
          usageCount: i % 100,
        })
      );

      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: true,
        data: {
          snippets: largeDataset,
          metadata: {
            exportedAt: new Date(),
            version: "1.0.0",
            count: 1000,
          },
        },
      });

      const exportOptions: ExportOptions = {
        format: "json",
        filePath: "/tmp/large-export.json",
        includeMetadata: true,
      };

      const exportResult = await importExportService.exportToFile(
        exportOptions
      );
      expect(exportResult.success).toBe(true);

      const jsonContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      const parsedData = JSON.parse(jsonContent);

      expect(parsedData.snippets).toHaveLength(1000);
      expect(parsedData.metadata.count).toBe(1000);
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    it("should handle empty snippet arrays", async () => {
      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: true,
        data: {
          snippets: [],
          metadata: {
            exportedAt: new Date(),
            version: "1.0.0",
            count: 0,
          },
        },
      });

      const exportOptions: ExportOptions = {
        format: "json",
        filePath: "/tmp/empty.json",
        includeMetadata: true,
      };

      const exportResult = await importExportService.exportToFile(
        exportOptions
      );
      expect(exportResult.success).toBe(true);

      const jsonContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      const parsedData = JSON.parse(jsonContent);

      expect(parsedData.snippets).toHaveLength(0);
      expect(parsedData.metadata.count).toBe(0);
    });

    it("should handle snippets with null/undefined optional fields", async () => {
      const snippetWithNulls: SnippetInterface = {
        id: "null-fields",
        title: "Snippet with nulls",
        description: "Has null optional fields",
        code: "console.log('test');",
        language: "javascript",
        tags: [],
        category: undefined,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
        usageCount: 0,
        prefix: undefined,
        scope: undefined,
      };

      vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue({
        success: true,
        data: {
          snippets: [snippetWithNulls],
          metadata: {
            exportedAt: new Date(),
            version: "1.0.0",
            count: 1,
          },
        },
      });

      const exportOptions: ExportOptions = {
        format: "json",
        filePath: "/tmp/nulls.json",
        includeMetadata: true,
      };

      const exportResult = await importExportService.exportToFile(
        exportOptions
      );
      expect(exportResult.success).toBe(true);

      const jsonContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      const parsedData = JSON.parse(jsonContent);

      expect(parsedData.snippets[0].category).toBeUndefined();
      expect(parsedData.snippets[0].prefix).toBeUndefined();
      expect(parsedData.snippets[0].scope).toBeUndefined();
      expect(parsedData.snippets[0].tags).toEqual([]);
    });

    it("should handle malformed import data gracefully", async () => {
      const malformedData = `{
        "snippets": [
          {
            "title": "Incomplete snippet"
            // Missing comma and other required fields
          }
        ]
      }`;

      vi.mocked(fs.readFile).mockResolvedValue(malformedData);

      const importOptions: ImportOptions = {
        filePath: "/tmp/malformed.json",
        conflictResolution: "skip",
      };

      const importResult = await importExportService.importFromFile(
        importOptions
      );
      expect(importResult.success).toBe(false);
      expect((importResult as any).error.type).toBe("validation");
    });
  });
});
