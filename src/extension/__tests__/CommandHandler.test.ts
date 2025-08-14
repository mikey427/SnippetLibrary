import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as vscode from "vscode";
import { CommandHandler } from "../CommandHandler";
import { ConfigurationManager } from "../ConfigurationManager";

// Mock VS Code API
vi.mock("vscode", () => ({
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    activeTextEditor: undefined,
    showInputBox: vi.fn(),
    showQuickPick: vi.fn(),
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
    showTextDocument: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: any) => defaultValue),
    })),
    fs: {
      writeFile: vi.fn(),
      readFile: vi.fn(),
    },
    openTextDocument: vi.fn(),
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path })),
  },
  SnippetString: vi.fn(),
  Selection: vi.fn(),
  Position: vi.fn(),
}));

describe("CommandHandler", () => {
  let commandHandler: CommandHandler;
  let mockSnippetManager: any;
  let mockConfigManager: ConfigurationManager;

  beforeEach(() => {
    // Create mock snippet manager
    mockSnippetManager = {
      createSnippet: vi
        .fn()
        .mockResolvedValue({
          success: true,
          data: { id: "test-id", title: "Test Snippet" },
        }),
      getAllSnippets: vi.fn().mockResolvedValue({ success: true, data: [] }),
      updateSnippet: vi.fn().mockResolvedValue({ success: true, data: {} }),
      deleteSnippet: vi.fn().mockResolvedValue({ success: true, data: true }),
      incrementUsage: vi
        .fn()
        .mockResolvedValue({ success: true, data: undefined }),
      refresh: vi.fn().mockResolvedValue({ success: true, data: undefined }),
      exportSnippets: vi.fn().mockResolvedValue({
        success: true,
        data: {
          snippets: [
            {
              id: "1",
              title: "Test",
              code: "test code",
              language: "javascript",
            },
          ],
          metadata: { exportedAt: new Date(), version: "1.0.0", count: 1 },
        },
      }),
      importSnippets: vi.fn().mockResolvedValue({
        success: true,
        data: { imported: 1, skipped: 0, errors: [], conflicts: [] },
      }),
    };

    mockConfigManager = new ConfigurationManager();
    commandHandler = new CommandHandler(mockSnippetManager, mockConfigManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("saveSnippet", () => {
    it("should show warning when no active editor", async () => {
      vi.mocked(vscode.window).activeTextEditor = undefined;

      await commandHandler.saveSnippet();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        "No active editor found. Please open a file and select code to save as snippet."
      );
    });

    it("should show warning when no code is selected", async () => {
      const mockEditor = {
        selection: { isEmpty: true },
        document: { languageId: "javascript" },
      };
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;

      await commandHandler.saveSnippet();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        "No code selected. Please select code to save as snippet."
      );
    });

    it("should save snippet successfully with valid input", async () => {
      const mockEditor = {
        selection: { isEmpty: false },
        document: {
          languageId: "javascript",
          getText: vi.fn().mockReturnValue("console.log('test');"),
        },
      };
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;

      // Mock user input
      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce("Test Snippet") // title
        .mockResolvedValueOnce("Test description") // description
        .mockResolvedValueOnce("test, utility") // tags
        .mockResolvedValueOnce("utilities") // category
        .mockResolvedValueOnce("testsnip"); // prefix

      await commandHandler.saveSnippet();

      expect(mockSnippetManager.createSnippet).toHaveBeenCalledWith({
        title: "Test Snippet",
        description: "Test description",
        code: "console.log('test');",
        language: "javascript",
        tags: ["test", "utility"],
        category: "utilities",
        prefix: "testsnip",
      });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Snippet "Test Snippet" saved successfully!'
      );
    });

    it("should handle save errors", async () => {
      const mockEditor = {
        selection: { isEmpty: false },
        document: {
          languageId: "javascript",
          getText: vi.fn().mockReturnValue("console.log('test');"),
        },
      };
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;

      vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(
        "Test Snippet"
      );

      mockSnippetManager.createSnippet.mockResolvedValue({
        success: false,
        error: { message: "Save failed" },
      });

      await commandHandler.saveSnippet();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to save snippet: Save failed"
      );
    });

    it("should return early when user cancels title input", async () => {
      const mockEditor = {
        selection: { isEmpty: false },
        document: {
          languageId: "javascript",
          getText: vi.fn().mockReturnValue("test"),
        },
      };
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;

      vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(undefined); // User cancels

      await commandHandler.saveSnippet();

      expect(mockSnippetManager.createSnippet).not.toHaveBeenCalled();
    });
  });

  describe("insertSnippet", () => {
    it("should show warning when no active editor", async () => {
      vi.mocked(vscode.window).activeTextEditor = undefined;

      await commandHandler.insertSnippet();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        "No active editor found. Please open a file to insert snippet."
      );
    });

    it("should show message when no snippets exist", async () => {
      const mockEditor = { selection: { active: {} } };
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;

      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: true,
        data: [],
      });

      await commandHandler.insertSnippet();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "No snippets found. Create some snippets first!"
      );
    });

    it("should insert selected snippet", async () => {
      const mockEditor = {
        selection: { active: {} },
        insertSnippet: vi.fn(),
      };
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;

      const mockSnippets = [
        {
          id: "1",
          title: "Test Snippet",
          language: "javascript",
          description: "Test",
          code: "console.log();",
        },
      ];
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: true,
        data: mockSnippets,
      });

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        snippet: mockSnippets[0],
      } as any);

      await commandHandler.insertSnippet();

      expect(mockEditor.insertSnippet).toHaveBeenCalled();
      expect(mockSnippetManager.incrementUsage).toHaveBeenCalledWith("1");
    });

    it("should handle snippet loading errors", async () => {
      const mockEditor = { selection: { active: {} } };
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;

      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: false,
        error: { message: "Load failed" },
      });

      await commandHandler.insertSnippet();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to load snippets: Load failed"
      );
    });
  });

  describe("manageSnippets", () => {
    it("should show message when no snippets exist", async () => {
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: true,
        data: [],
      });

      await commandHandler.manageSnippets();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "No snippets found. Create some snippets first!"
      );
    });

    it("should handle refresh action", async () => {
      const mockSnippets = [
        {
          id: "1",
          title: "Test",
          language: "js",
          tags: [],
          description: "Test snippet",
        },
      ];
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: true,
        data: mockSnippets,
      });

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        action: "refresh",
      } as any);

      await commandHandler.manageSnippets();

      expect(mockSnippetManager.refresh).toHaveBeenCalled();
    });

    it("should handle export action", async () => {
      const mockSnippets = [
        {
          id: "1",
          title: "Test",
          language: "js",
          tags: [],
          description: "Test snippet",
        },
      ];
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: true,
        data: mockSnippets,
      });

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        action: "export",
      } as any);

      vi.mocked(vscode.window.showSaveDialog).mockResolvedValue({
        fsPath: "/test/export.json",
      } as any);

      await commandHandler.manageSnippets();

      expect(mockSnippetManager.exportSnippets).toHaveBeenCalled();
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it("should handle import action", async () => {
      const mockSnippets = [
        {
          id: "1",
          title: "Test",
          language: "js",
          tags: [],
          description: "Test snippet",
        },
      ];
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: true,
        data: mockSnippets,
      });

      vi.mocked(vscode.window.showQuickPick)
        .mockResolvedValueOnce({ action: "import" } as any)
        .mockResolvedValueOnce({ value: "skip" } as any);

      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([
        { fsPath: "/test/import.json" },
      ] as any);

      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        Buffer.from(JSON.stringify({ snippets: [] }))
      );

      await commandHandler.manageSnippets();

      expect(mockSnippetManager.importSnippets).toHaveBeenCalled();
    });
  });

  describe("refreshSnippets", () => {
    it("should refresh snippets successfully", async () => {
      await commandHandler.refreshSnippets();

      expect(mockSnippetManager.refresh).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Snippets refreshed successfully!"
      );
    });

    it("should handle refresh errors", async () => {
      mockSnippetManager.refresh.mockResolvedValue({
        success: false,
        error: { message: "Refresh failed" },
      });

      await commandHandler.refreshSnippets();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to refresh snippets: Refresh failed"
      );
    });
  });

  describe("exportSnippets", () => {
    it("should export snippets successfully", async () => {
      vi.mocked(vscode.window.showSaveDialog).mockResolvedValue({
        fsPath: "/test/export.json",
      } as any);

      await commandHandler.exportSnippets();

      expect(mockSnippetManager.exportSnippets).toHaveBeenCalled();
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining("Exported 1 snippets")
      );
    });

    it("should handle export errors", async () => {
      mockSnippetManager.exportSnippets.mockResolvedValue({
        success: false,
        error: { message: "Export failed" },
      });

      await commandHandler.exportSnippets();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to export snippets: Export failed"
      );
    });
  });

  describe("importSnippets", () => {
    it("should import snippets successfully", async () => {
      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([
        { fsPath: "/test/import.json" },
      ] as any);

      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        Buffer.from(
          JSON.stringify({
            snippets: [{ title: "Test", code: "test", language: "js" }],
          })
        )
      );

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        value: "skip",
      } as any);

      await commandHandler.importSnippets();

      expect(mockSnippetManager.importSnippets).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining("Import completed")
      );
    });

    it("should handle import errors", async () => {
      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([
        { fsPath: "/test/import.json" },
      ] as any);

      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        Buffer.from("invalid json")
      );

      await commandHandler.importSnippets();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("Error importing snippets")
      );
    });
  });

  describe("openWebGUI", () => {
    it("should show placeholder message", async () => {
      await commandHandler.openWebGUI();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Web GUI functionality will be implemented in a later task."
      );
    });
  });

  describe("updateSnippetManager", () => {
    it("should update snippet manager reference", () => {
      const newSnippetManager = { test: "new manager" } as any;
      commandHandler.updateSnippetManager(newSnippetManager);

      expect((commandHandler as any).snippetManager).toBe(newSnippetManager);
    });
  });
});
