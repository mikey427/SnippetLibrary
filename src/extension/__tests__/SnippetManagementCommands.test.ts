import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import * as vscode from "vscode";
import { CommandHandler } from "../CommandHandler";
import { SnippetManagerImpl } from "../../core/services/SnippetManagerImpl";
import { ConfigurationManager } from "../ConfigurationManager";
import { SnippetInterface, SnippetData } from "../../types";

// Mock VS Code API
vi.mock("vscode", () => ({
  window: {
    showInputBox: vi.fn(),
    showQuickPick: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showTextDocument: vi.fn(),
    withProgress: vi.fn(),
    activeTextEditor: null,
  },
  workspace: {
    openTextDocument: vi.fn(),
    fs: {
      writeFile: vi.fn(),
    },
  },
  commands: {
    executeCommand: vi.fn(),
  },
  ViewColumn: {
    Beside: 2,
  },
  ProgressLocation: {
    Notification: 15,
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path })),
  },
}));

describe("CommandHandler - Snippet Management Commands", () => {
  let commandHandler: CommandHandler;
  let mockSnippetManager: SnippetManagerImpl;
  let mockConfigManager: ConfigurationManager;

  const mockSnippets: SnippetInterface[] = [
    {
      id: "1",
      title: "Test Snippet 1",
      description: "Test description 1",
      code: "console.log('test1');",
      language: "javascript",
      tags: ["test", "console"],
      category: "utilities",
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-01"),
      usageCount: 5,
      prefix: "test1",
    },
    {
      id: "2",
      title: "Test Snippet 2",
      description: "Test description 2",
      code: "print('test2')",
      language: "python",
      tags: ["test", "print"],
      category: "utilities",
      createdAt: new Date("2023-01-02"),
      updatedAt: new Date("2023-01-02"),
      usageCount: 3,
    },
    {
      id: "3",
      title: "Test Snippet 3",
      description: "Test description 3",
      code: "echo 'test3'",
      language: "bash",
      tags: ["test", "echo"],
      createdAt: new Date("2023-01-03"),
      updatedAt: new Date("2023-01-03"),
      usageCount: 1,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock SnippetManager
    mockSnippetManager = {
      getAllSnippets: vi.fn(),
      updateSnippet: vi.fn(),
      deleteSnippet: vi.fn(),
      getTags: vi.fn(),
      getCategories: vi.fn(),
      getLanguages: vi.fn(),
      getUsageStatistics: vi.fn(),
    } as any;

    // Mock ConfigurationManager
    mockConfigManager = {} as any;

    commandHandler = new CommandHandler(mockSnippetManager, mockConfigManager);
  });

  describe("Edit Snippet Functionality", () => {
    it("should edit all properties of a snippet", async () => {
      const snippet = mockSnippets[0];

      // Mock user selections and inputs
      (vscode.window.showQuickPick as Mock).mockResolvedValueOnce({
        value: "all",
      }); // Edit all properties

      (vscode.window.showInputBox as Mock)
        .mockResolvedValueOnce("Updated Title") // title
        .mockResolvedValueOnce("Updated Description") // description
        .mockResolvedValueOnce("updated, test") // tags
        .mockResolvedValueOnce("updated-utilities") // category
        .mockResolvedValueOnce("uptest"); // prefix

      (vscode.workspace.openTextDocument as Mock).mockResolvedValue({
        getText: () => "console.log('updated');",
      });

      (vscode.window.showTextDocument as Mock).mockResolvedValue({
        document: { getText: () => "console.log('updated');" },
      });

      (vscode.window.showInformationMessage as Mock).mockResolvedValueOnce(
        "Save Changes"
      );

      (vscode.commands.executeCommand as Mock).mockResolvedValue(undefined);

      (mockSnippetManager.updateSnippet as Mock).mockResolvedValue({
        success: true,
        data: { ...snippet, title: "Updated Title" },
      });

      // Call the private method through reflection
      await (commandHandler as any).editSnippet(snippet);

      expect(mockSnippetManager.updateSnippet).toHaveBeenCalledWith(
        snippet.id,
        expect.objectContaining({
          title: "Updated Title",
          description: "Updated Description",
          tags: ["updated", "test"],
          category: "updated-utilities",
          prefix: "uptest",
        })
      );
    });

    it("should edit only metadata when selected", async () => {
      const snippet = mockSnippets[0];

      (vscode.window.showQuickPick as Mock).mockResolvedValueOnce({
        value: "metadata",
      });

      (vscode.window.showInputBox as Mock)
        .mockResolvedValueOnce("New Title")
        .mockResolvedValueOnce("New Description");

      (mockSnippetManager.updateSnippet as Mock).mockResolvedValue({
        success: true,
        data: snippet,
      });

      await (commandHandler as any).editSnippet(snippet);

      expect(mockSnippetManager.updateSnippet).toHaveBeenCalledWith(
        snippet.id,
        {
          title: "New Title",
          description: "New Description",
        }
      );
    });

    it("should handle edit cancellation gracefully", async () => {
      const snippet = mockSnippets[0];

      (vscode.window.showQuickPick as Mock).mockResolvedValueOnce(undefined); // User cancels

      await (commandHandler as any).editSnippet(snippet);

      expect(mockSnippetManager.updateSnippet).not.toHaveBeenCalled();
    });

    it("should handle update errors", async () => {
      const snippet = mockSnippets[0];

      (vscode.window.showQuickPick as Mock).mockResolvedValueOnce({
        value: "metadata",
      });

      (vscode.window.showInputBox as Mock)
        .mockResolvedValueOnce("New Title")
        .mockResolvedValueOnce("New Description");

      (mockSnippetManager.updateSnippet as Mock).mockResolvedValue({
        success: false,
        error: { message: "Update failed" },
      });

      await (commandHandler as any).editSnippet(snippet);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to update snippet: Update failed"
      );
    });
  });

  describe("Bulk Operations", () => {
    beforeEach(() => {
      (mockSnippetManager.getAllSnippets as Mock).mockResolvedValue({
        success: true,
        data: mockSnippets,
      });
    });

    it("should perform bulk delete operation", async () => {
      const selectedSnippets = [mockSnippets[0], mockSnippets[1]];

      (vscode.window.showQuickPick as Mock)
        .mockResolvedValueOnce(selectedSnippets.map((s) => ({ snippet: s }))) // Select snippets
        .mockResolvedValueOnce({ value: "delete" }); // Select delete operation

      (vscode.window.showWarningMessage as Mock).mockResolvedValueOnce(
        "Delete All"
      );

      (vscode.window.withProgress as Mock).mockImplementation(
        async (options, callback) => {
          await callback({ report: vi.fn() });
        }
      );

      (mockSnippetManager.deleteSnippet as Mock)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });

      await (commandHandler as any).bulkOperations();

      expect(mockSnippetManager.deleteSnippet).toHaveBeenCalledTimes(2);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Successfully deleted 2 snippets!"
      );
    });

    it("should perform bulk add tags operation", async () => {
      const selectedSnippets = [mockSnippets[0], mockSnippets[1]];

      (vscode.window.showQuickPick as Mock)
        .mockResolvedValueOnce(selectedSnippets.map((s) => ({ snippet: s })))
        .mockResolvedValueOnce({ value: "addTags" });

      (mockSnippetManager.getTags as Mock).mockResolvedValue({
        success: true,
        data: ["existing", "tag"],
      });

      (vscode.window.showInputBox as Mock).mockResolvedValueOnce("new, tag");

      (vscode.window.withProgress as Mock).mockImplementation(
        async (options, callback) => {
          await callback({ report: vi.fn() });
        }
      );

      (mockSnippetManager.updateSnippet as Mock).mockResolvedValue({
        success: true,
      });

      await (commandHandler as any).bulkOperations();

      expect(mockSnippetManager.updateSnippet).toHaveBeenCalledTimes(2);
      expect(mockSnippetManager.updateSnippet).toHaveBeenCalledWith(
        mockSnippets[0].id,
        { tags: expect.arrayContaining(["test", "console", "new", "tag"]) }
      );
    });

    it("should perform bulk remove tags operation", async () => {
      const selectedSnippets = [mockSnippets[0], mockSnippets[1]];

      (vscode.window.showQuickPick as Mock)
        .mockResolvedValueOnce(selectedSnippets.map((s) => ({ snippet: s })))
        .mockResolvedValueOnce({ value: "removeTags" })
        .mockResolvedValueOnce([{ value: "test" }]); // Remove "test" tag

      (vscode.window.withProgress as Mock).mockImplementation(
        async (options, callback) => {
          await callback({ report: vi.fn() });
        }
      );

      (mockSnippetManager.updateSnippet as Mock).mockResolvedValue({
        success: true,
      });

      await (commandHandler as any).bulkOperations();

      expect(mockSnippetManager.updateSnippet).toHaveBeenCalledWith(
        mockSnippets[0].id,
        { tags: ["console"] }
      );
      expect(mockSnippetManager.updateSnippet).toHaveBeenCalledWith(
        mockSnippets[1].id,
        { tags: ["print"] }
      );
    });

    it("should perform bulk set category operation", async () => {
      const selectedSnippets = [mockSnippets[0], mockSnippets[1]];

      (vscode.window.showQuickPick as Mock)
        .mockResolvedValueOnce(selectedSnippets.map((s) => ({ snippet: s })))
        .mockResolvedValueOnce({ value: "setCategory" })
        .mockResolvedValueOnce({ value: "__new__" });

      (mockSnippetManager.getCategories as Mock).mockResolvedValue({
        success: true,
        data: ["utilities"],
      });

      (vscode.window.showInputBox as Mock).mockResolvedValueOnce(
        "new-category"
      );

      (vscode.window.withProgress as Mock).mockImplementation(
        async (options, callback) => {
          await callback({ report: vi.fn() });
        }
      );

      (mockSnippetManager.updateSnippet as Mock).mockResolvedValue({
        success: true,
      });

      await (commandHandler as any).bulkOperations();

      expect(mockSnippetManager.updateSnippet).toHaveBeenCalledTimes(2);
      expect(mockSnippetManager.updateSnippet).toHaveBeenCalledWith(
        mockSnippets[0].id,
        { category: "new-category" }
      );
    });

    it("should handle bulk operation errors gracefully", async () => {
      const selectedSnippets = [mockSnippets[0], mockSnippets[1]];

      (vscode.window.showQuickPick as Mock)
        .mockResolvedValueOnce(selectedSnippets.map((s) => ({ snippet: s })))
        .mockResolvedValueOnce({ value: "delete" });

      (vscode.window.showWarningMessage as Mock).mockResolvedValueOnce(
        "Delete All"
      );

      (vscode.window.withProgress as Mock).mockImplementation(
        async (options, callback) => {
          await callback({ report: vi.fn() });
        }
      );

      (mockSnippetManager.deleteSnippet as Mock)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({
          success: false,
          error: { message: "Delete failed" },
        });

      await (commandHandler as any).bulkOperations();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        "Deleted 1 snippets, 1 failed. Check output for details."
      );
    });
  });

  describe("Organization Features", () => {
    beforeEach(() => {
      (mockSnippetManager.getAllSnippets as Mock).mockResolvedValue({
        success: true,
        data: mockSnippets,
      });
    });

    it("should view snippets by category", async () => {
      (mockSnippetManager.getCategories as Mock).mockResolvedValue({
        success: true,
        data: ["utilities"],
      });

      (vscode.window.showQuickPick as Mock)
        .mockResolvedValueOnce({ value: "utilities" })
        .mockResolvedValueOnce({ snippet: mockSnippets[0] })
        .mockResolvedValueOnce({ value: "edit" })
        .mockResolvedValueOnce({ value: "metadata" });

      (vscode.window.showInputBox as Mock)
        .mockResolvedValueOnce("New Title")
        .mockResolvedValueOnce("New Description");

      (mockSnippetManager.updateSnippet as Mock).mockResolvedValue({
        success: true,
        data: mockSnippets[0],
      });

      await (commandHandler as any).viewSnippetsByCategory();

      expect(mockSnippetManager.getCategories).toHaveBeenCalled();
      expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(4);
    });

    it("should view snippets by tags", async () => {
      (mockSnippetManager.getTags as Mock).mockResolvedValue({
        success: true,
        data: ["test", "console", "print"],
      });

      (vscode.window.showQuickPick as Mock)
        .mockResolvedValueOnce({ value: "test" })
        .mockResolvedValueOnce({ snippet: mockSnippets[0] })
        .mockResolvedValueOnce({ value: "edit" })
        .mockResolvedValueOnce({ value: "metadata" });

      (vscode.window.showInputBox as Mock)
        .mockResolvedValueOnce("New Title")
        .mockResolvedValueOnce("New Description");

      (mockSnippetManager.updateSnippet as Mock).mockResolvedValue({
        success: true,
        data: mockSnippets[0],
      });

      await (commandHandler as any).viewSnippetsByTags();

      expect(mockSnippetManager.getTags).toHaveBeenCalled();
      expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(4);
    });

    it("should view snippets by language", async () => {
      (mockSnippetManager.getLanguages as Mock).mockResolvedValue({
        success: true,
        data: ["javascript", "python", "bash"],
      });

      (vscode.window.showQuickPick as Mock)
        .mockResolvedValueOnce({ value: "javascript" })
        .mockResolvedValueOnce({ snippet: mockSnippets[0] })
        .mockResolvedValueOnce({ value: "edit" })
        .mockResolvedValueOnce({ value: "metadata" });

      (vscode.window.showInputBox as Mock)
        .mockResolvedValueOnce("New Title")
        .mockResolvedValueOnce("New Description");

      (mockSnippetManager.updateSnippet as Mock).mockResolvedValue({
        success: true,
        data: mockSnippets[0],
      });

      await (commandHandler as any).viewSnippetsByLanguage();

      expect(mockSnippetManager.getLanguages).toHaveBeenCalled();
      expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(4);
    });

    it("should show usage statistics", async () => {
      const mockStats = {
        totalSnippets: 3,
        totalUsage: 9,
        averageUsage: 3,
        mostUsedSnippets: [
          { snippet: mockSnippets[0], usageCount: 5 },
          { snippet: mockSnippets[1], usageCount: 3 },
        ],
        languageDistribution: [
          { language: "javascript", count: 1, percentage: 33.3 },
          { language: "python", count: 1, percentage: 33.3 },
          { language: "bash", count: 1, percentage: 33.3 },
        ],
        tagDistribution: [
          { tag: "test", count: 3, percentage: 100 },
          { tag: "console", count: 1, percentage: 33.3 },
        ],
        categoryDistribution: [
          { category: "utilities", count: 2, percentage: 66.7 },
        ],
        recentlyCreated: mockSnippets,
        recentlyUpdated: mockSnippets,
      };

      (mockSnippetManager.getUsageStatistics as Mock).mockResolvedValue({
        success: true,
        data: mockStats,
      });

      (vscode.workspace.openTextDocument as Mock).mockResolvedValue({
        content: "# Statistics",
      });

      await (commandHandler as any).showUsageStatistics();

      expect(mockSnippetManager.getUsageStatistics).toHaveBeenCalled();
      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith({
        content: expect.stringContaining("# Snippet Library Statistics"),
        language: "markdown",
      });
    });

    it("should perform cleanup operations", async () => {
      const snippetsWithDuplicates = [
        {
          ...mockSnippets[0],
          tags: ["test", "test", "console"], // Duplicate tags
        },
        {
          ...mockSnippets[1],
          category: "  Utilities  ", // Needs normalization
        },
      ];

      (mockSnippetManager.getAllSnippets as Mock).mockResolvedValue({
        success: true,
        data: snippetsWithDuplicates,
      });

      (vscode.window.showQuickPick as Mock).mockResolvedValueOnce([
        { value: "duplicates" },
        { value: "categories" },
      ]);

      (mockSnippetManager.updateSnippet as Mock).mockResolvedValue({
        success: true,
      });

      await (commandHandler as any).cleanupOrganization();

      expect(mockSnippetManager.updateSnippet).toHaveBeenCalledWith(
        snippetsWithDuplicates[0].id,
        { tags: ["test", "console"] }
      );
      expect(mockSnippetManager.updateSnippet).toHaveBeenCalledWith(
        snippetsWithDuplicates[1].id,
        { category: "utilities" }
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle snippet manager errors gracefully", async () => {
      (mockSnippetManager.getAllSnippets as Mock).mockResolvedValue({
        success: false,
        error: { message: "Storage error" },
      });

      await (commandHandler as any).bulkOperations();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to load snippets: Storage error"
      );
    });

    it("should handle empty snippet collections", async () => {
      (mockSnippetManager.getAllSnippets as Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      await (commandHandler as any).bulkOperations();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "No snippets found!"
      );
    });

    it("should handle user cancellation in bulk operations", async () => {
      (mockSnippetManager.getAllSnippets as Mock).mockResolvedValue({
        success: true,
        data: mockSnippets,
      });

      (vscode.window.showQuickPick as Mock).mockResolvedValueOnce(undefined); // User cancels

      await (commandHandler as any).bulkOperations();

      expect(mockSnippetManager.deleteSnippet).not.toHaveBeenCalled();
    });
  });

  describe("Individual Snippet Management", () => {
    it("should handle individual snippet deletion with confirmation", async () => {
      const snippet = mockSnippets[0];

      (vscode.window.showWarningMessage as Mock).mockResolvedValueOnce(
        "Delete"
      );

      (mockSnippetManager.deleteSnippet as Mock).mockResolvedValue({
        success: true,
      });

      await (commandHandler as any).deleteSnippet(snippet);

      expect(mockSnippetManager.deleteSnippet).toHaveBeenCalledWith(snippet.id);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        `Snippet "${snippet.title}" deleted successfully!`
      );
    });

    it("should handle deletion cancellation", async () => {
      const snippet = mockSnippets[0];

      (vscode.window.showWarningMessage as Mock).mockResolvedValueOnce(
        undefined
      ); // User cancels

      await (commandHandler as any).deleteSnippet(snippet);

      expect(mockSnippetManager.deleteSnippet).not.toHaveBeenCalled();
    });

    it("should handle deletion errors", async () => {
      const snippet = mockSnippets[0];

      (vscode.window.showWarningMessage as Mock).mockResolvedValueOnce(
        "Delete"
      );

      (mockSnippetManager.deleteSnippet as Mock).mockResolvedValue({
        success: false,
        error: { message: "Delete failed" },
      });

      await (commandHandler as any).deleteSnippet(snippet);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to delete snippet: Delete failed"
      );
    });
  });
});
