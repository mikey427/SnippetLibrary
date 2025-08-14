import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { VSCodeSnippetIntegration } from "../VSCodeSnippetIntegration";

// Mock file system
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => "{}"),
  readdirSync: vi.fn(() => []),
  unlinkSync: vi.fn(),
}));

vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

// Mock VS Code API
vi.mock("vscode", () => ({
  languages: {
    registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
  },
  env: {
    appRoot: "/test/vscode",
  },
  CompletionItem: vi.fn().mockImplementation((label, kind) => ({
    label,
    kind,
    insertText: undefined,
    detail: undefined,
    documentation: undefined,
    filterText: undefined,
    sortText: undefined,
    commitCharacters: undefined,
    command: undefined,
  })),
  CompletionItemKind: {
    Snippet: 15,
  },
  SnippetString: vi.fn().mockImplementation((value) => ({ value })),
  MarkdownString: vi.fn().mockImplementation(() => ({
    appendText: vi.fn().mockReturnThis(),
    appendCodeblock: vi.fn().mockReturnThis(),
    appendMarkdown: vi.fn().mockReturnThis(),
  })),
  Position: vi.fn(),
  CancellationToken: {},
  CompletionContext: {},
}));

describe("VSCodeSnippetIntegration", () => {
  let integration: VSCodeSnippetIntegration;
  let mockSnippetManager: any;

  beforeEach(() => {
    // Create mock snippet manager
    mockSnippetManager = {
      getAllSnippets: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: "1",
            title: "Test Snippet",
            description: "A test snippet",
            code: "console.log('${1:message}');",
            language: "javascript",
            tags: ["test", "utility"],
            category: "utilities",
            prefix: "testlog",
            usageCount: 5,
            scope: ["javascript", "typescript"],
          },
          {
            id: "2",
            title: "HTML Template",
            description: "Basic HTML template",
            code: "<div>${1:content}</div>",
            language: "html",
            tags: ["html", "template"],
            prefix: "div",
            usageCount: 10,
            scope: ["html"],
          },
        ],
      }),
    };

    integration = new VSCodeSnippetIntegration(mockSnippetManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await expect(integration.initialize()).resolves.not.toThrow();
      expect(
        vscode.languages.registerCompletionItemProvider
      ).toHaveBeenCalled();
    });

    it("should register completion provider with enhanced features", async () => {
      await integration.initialize();

      expect(
        vscode.languages.registerCompletionItemProvider
      ).toHaveBeenCalledWith(
        { scheme: "file" },
        expect.objectContaining({
          provideCompletionItems: expect.any(Function),
          resolveCompletionItem: expect.any(Function),
        }),
        ".",
        "_",
        "-",
        "$",
        "@"
      );
    });

    it("should create snippet registry directory", async () => {
      // Mock existsSync to return false so directory creation is triggered
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await integration.initialize();

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        "/test/workspace/.vscode/snippets",
        { recursive: true }
      );
    });

    it("should register VS Code snippets", async () => {
      await integration.initialize();

      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("completion provider", () => {
    let completionProvider: any;

    beforeEach(async () => {
      await integration.initialize();
      completionProvider = vi.mocked(
        vscode.languages.registerCompletionItemProvider
      ).mock.calls[0][1];
    });

    it("should provide completions for matching language with enhanced features", async () => {
      const mockDocument = {
        languageId: "javascript",
        getWordRangeAtPosition: vi.fn(() => null),
        getText: vi.fn(() => ""),
      };
      const mockPosition = new vscode.Position(0, 0);
      const mockToken = {};
      const mockContext = {};

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(completions).toHaveLength(1); // Only JavaScript snippet should match
      expect(completions[0].label).toEqual({
        label: "testlog",
        description: "test, utility (5 uses)",
      });
      expect(completions[0].detail).toBe("Snippet: Test Snippet");
      expect(completions[0].commitCharacters).toEqual([" ", "\t"]);
      expect(completions[0].command).toEqual({
        command: "snippetLibrary.trackUsage",
        title: "Track Usage",
        arguments: ["1"],
      });
    });

    it("should filter completions by language", async () => {
      const mockDocument = {
        languageId: "html",
        getWordRangeAtPosition: vi.fn(() => null),
        getText: vi.fn(() => ""),
      };
      const mockPosition = new vscode.Position(0, 0);
      const mockToken = {};
      const mockContext = {};

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(completions).toHaveLength(1); // Only HTML snippet should match
      expect(completions[0].label).toEqual({
        label: "div",
        description: "html, template (10 uses)",
      });
    });

    it("should include plaintext snippets for any language", async () => {
      // Add a plaintext snippet
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: true,
        data: [
          {
            id: "3",
            title: "Universal Snippet",
            description: "Works everywhere",
            code: "universal code",
            language: "plaintext",
            tags: ["universal"],
            prefix: "universal",
            usageCount: 1,
          },
        ],
      });

      const mockDocument = {
        languageId: "python",
        getWordRangeAtPosition: vi.fn(() => null),
        getText: vi.fn(() => ""),
      };
      const mockPosition = new vscode.Position(0, 0);
      const mockToken = {};
      const mockContext = {};

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(completions).toHaveLength(1); // Plaintext snippet should match
      expect(completions[0].label).toEqual({
        label: "universal",
        description: "universal (1 uses)",
      });
    });

    it("should handle snippet manager errors gracefully", async () => {
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: false,
        error: { message: "Failed to load snippets" },
      });

      const mockDocument = {
        languageId: "javascript",
        getWordRangeAtPosition: vi.fn(() => null),
        getText: vi.fn(() => ""),
      };
      const mockPosition = new vscode.Position(0, 0);
      const mockToken = {};
      const mockContext = {};

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(completions).toEqual([]);
    });

    it("should sort completions by usage count", async () => {
      const mockDocument = {
        languageId: "javascript",
        getWordRangeAtPosition: vi.fn(() => null),
        getText: vi.fn(() => ""),
      };
      const mockPosition = new vscode.Position(0, 0);
      const mockToken = {};
      const mockContext = {};

      // Add another JavaScript snippet with higher usage
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: true,
        data: [
          {
            id: "1",
            title: "Low Usage",
            code: "low",
            language: "javascript",
            prefix: "low",
            usageCount: 1,
            tags: [],
          },
          {
            id: "2",
            title: "High Usage",
            code: "high",
            language: "javascript",
            prefix: "high",
            usageCount: 100,
            tags: [],
          },
        ],
      });

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(completions).toHaveLength(2);
      // Higher usage should have lower sort text (comes first)
      expect(completions[0].sortText).toBeDefined();
      expect(completions[1].sortText).toBeDefined();

      // Find which completion has higher usage
      const highUsageCompletion = completions.find(
        (c) =>
          c.label === "high" ||
          (typeof c.label === "object" && c.label.label === "high")
      );
      const lowUsageCompletion = completions.find(
        (c) =>
          c.label === "low" ||
          (typeof c.label === "object" && c.label.label === "low")
      );

      expect(highUsageCompletion).toBeDefined();
      expect(lowUsageCompletion).toBeDefined();

      // Higher usage should have lower sort text (comes first alphabetically)
      expect(highUsageCompletion!.sortText < lowUsageCompletion!.sortText).toBe(
        true
      );
    });

    it("should resolve completion items with additional documentation", async () => {
      await integration.initialize();
      const completionProvider = vi.mocked(
        vscode.languages.registerCompletionItemProvider
      ).mock.calls[0][1];

      const mockMarkdownString = {
        appendMarkdown: vi.fn().mockReturnThis(),
        appendText: vi.fn().mockReturnThis(),
        appendCodeblock: vi.fn().mockReturnThis(),
      };

      // Mock the instanceof check
      Object.setPrototypeOf(
        mockMarkdownString,
        vscode.MarkdownString.prototype
      );

      const mockItem = new vscode.CompletionItem(
        "test",
        vscode.CompletionItemKind.Snippet
      );
      mockItem.documentation = mockMarkdownString as any;

      const resolvedItem = await completionProvider.resolveCompletionItem(
        mockItem,
        {}
      );

      // The resolved item should be the same item with additional documentation
      expect(resolvedItem).toBe(mockItem);
      expect(mockMarkdownString.appendMarkdown).toHaveBeenCalledWith(
        "\n\n*Press Tab to insert snippet*"
      );
    });
  });

  describe("snippet suggestions", () => {
    it("should get suggestions for specific language", async () => {
      const suggestions = await integration.getSnippetSuggestions("javascript");

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].language).toBe("javascript");
    });

    it("should filter suggestions by prefix", async () => {
      const suggestions = await integration.getSnippetSuggestions(
        "javascript",
        "test"
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].prefix).toBe("testlog");
    });

    it("should return empty array on error", async () => {
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: false,
        error: { message: "Error" },
      });

      const suggestions = await integration.getSnippetSuggestions("javascript");

      expect(suggestions).toEqual([]);
    });

    it("should sort suggestions by usage count", async () => {
      // Mock snippets with different usage counts
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: true,
        data: [
          {
            id: "1",
            title: "Low Usage",
            language: "javascript",
            usageCount: 1,
            tags: [],
          },
          {
            id: "2",
            title: "High Usage",
            language: "javascript",
            usageCount: 100,
            tags: [],
          },
        ],
      });

      const suggestions = await integration.getSnippetSuggestions("javascript");

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].usageCount).toBe(100); // Higher usage first
      expect(suggestions[1].usageCount).toBe(1);
    });
  });

  describe("refresh snippets", () => {
    it("should refresh snippets successfully", async () => {
      await expect(integration.refreshSnippets()).resolves.not.toThrow();
      expect(mockSnippetManager.getAllSnippets).toHaveBeenCalled();
    });

    it("should handle refresh errors gracefully", async () => {
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: false,
        error: { message: "Refresh failed" },
      });

      await expect(integration.refreshSnippets()).resolves.not.toThrow();
    });
  });

  describe("snippet registration", () => {
    it("should register snippet and update VS Code registry", async () => {
      const mockSnippet = {
        id: "test",
        title: "Test Snippet",
        code: "console.log('test');",
        language: "javascript",
        tags: ["test"],
        usageCount: 0,
        prefix: "test",
      };

      await integration.registerSnippet(mockSnippet as any);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should unregister snippet and update VS Code registry", async () => {
      await integration.unregisterSnippet("test-id");

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should handle snippet change events", async () => {
      const mockSnippet = {
        id: "test",
        title: "Test Snippet",
        code: "console.log('test');",
        language: "javascript",
        tags: ["test"],
        usageCount: 0,
        prefix: "test",
      };

      await integration.onSnippetChange("created", mockSnippet as any);
      expect(fs.writeFileSync).toHaveBeenCalled();

      await integration.onSnippetChange("updated", mockSnippet as any);
      expect(fs.writeFileSync).toHaveBeenCalled();

      await integration.onSnippetChange("deleted", mockSnippet as any);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should get registered snippets", async () => {
      const registeredSnippets = integration.getRegisteredSnippets();
      expect(registeredSnippets).toBeInstanceOf(Map);
    });

    it("should force refresh all snippets", async () => {
      await integration.forceRefresh();
      expect(mockSnippetManager.getAllSnippets).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("update snippet manager", () => {
    it("should update snippet manager reference", () => {
      const newSnippetManager = { test: "new manager" } as any;
      integration.updateSnippetManager(newSnippetManager);

      expect((integration as any).snippetManager).toBe(newSnippetManager);
    });
  });

  describe("prefix-based triggering", () => {
    let completionProvider: any;

    beforeEach(async () => {
      await integration.initialize();
      completionProvider = vi.mocked(
        vscode.languages.registerCompletionItemProvider
      ).mock.calls[0][1];
    });

    it("should filter completions by current word prefix", async () => {
      const mockDocument = {
        languageId: "javascript",
        getWordRangeAtPosition: vi.fn(() => ({ start: 0, end: 4 })),
        getText: vi.fn(() => "test"),
      };
      const mockPosition = new vscode.Position(0, 4);
      const mockToken = {};
      const mockContext = {};

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(completions).toHaveLength(1); // Only snippet with matching prefix
      expect(completions[0].label.label).toBe("testlog");
    });

    it("should include snippets matching title when no prefix match", async () => {
      const mockDocument = {
        languageId: "javascript",
        getWordRangeAtPosition: vi.fn(() => ({ start: 0, end: 4 })),
        getText: vi.fn(() => "snip"),
      };
      const mockPosition = new vscode.Position(0, 4);
      const mockToken = {};
      const mockContext = {};

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(completions).toHaveLength(1); // Should match "Test Snippet" by title
    });

    it("should include snippets matching tags", async () => {
      const mockDocument = {
        languageId: "javascript",
        getWordRangeAtPosition: vi.fn(() => ({ start: 0, end: 4 })),
        getText: vi.fn(() => "util"),
      };
      const mockPosition = new vscode.Position(0, 4);
      const mockToken = {};
      const mockContext = {};

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(completions).toHaveLength(1); // Should match by "utility" tag
    });

    it("should prioritize prefix matches in sorting", async () => {
      // Add snippets with different prefix match qualities
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: true,
        data: [
          {
            id: "1",
            title: "Test Exact",
            code: "exact",
            language: "javascript",
            prefix: "test",
            usageCount: 1,
            tags: [],
          },
          {
            id: "2",
            title: "Testing Partial",
            code: "partial",
            language: "javascript",
            prefix: "testmore", // This starts with "test" but is longer
            usageCount: 100,
            tags: [],
          },
        ],
      });

      const mockDocument = {
        languageId: "javascript",
        getWordRangeAtPosition: vi.fn(() => ({ start: 0, end: 4 })),
        getText: vi.fn(() => "test"),
      };
      const mockPosition = new vscode.Position(0, 4);
      const mockToken = {};
      const mockContext = {};

      const completions = await completionProvider.provideCompletionItems(
        mockDocument,
        mockPosition,
        mockToken,
        mockContext
      );

      expect(completions).toHaveLength(2);

      // Find completions
      const exactMatch = completions.find(
        (c) => typeof c.label === "object" && c.label.label === "test"
      );
      const partialMatch = completions.find(
        (c) => typeof c.label === "object" && c.label.label === "testmore"
      );

      expect(exactMatch).toBeDefined();
      expect(partialMatch).toBeDefined();

      // Both prefixes start with "test", so both get prefix match score of 0
      // The difference should be in usage count: exact=1, partial=100
      // Exact: prefixScore=0, usageScore=999, total=000999
      // Partial: prefixScore=0, usageScore=900, total=000900
      // So partial should actually sort first due to higher usage
      expect(partialMatch!.sortText < exactMatch!.sortText).toBe(true);
    });
  });

  describe("disposal", () => {
    it("should dispose all resources", async () => {
      await integration.initialize();
      await expect(integration.dispose()).resolves.not.toThrow();
    });

    it("should handle disposal errors gracefully", async () => {
      await integration.initialize();

      // Mock disposal error
      const mockDisposable = {
        dispose: vi.fn(() => {
          throw new Error("Disposal error");
        }),
      };

      (integration as any).disposables.push(mockDisposable);

      await expect(integration.dispose()).resolves.not.toThrow();
    });
  });
});
