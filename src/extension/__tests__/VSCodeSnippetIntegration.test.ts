import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as vscode from "vscode";
import { VSCodeSnippetIntegration } from "../VSCodeSnippetIntegration";

// Mock VS Code API
vi.mock("vscode", () => ({
  languages: {
    registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  CompletionItem: vi.fn().mockImplementation((label, kind) => ({
    label,
    kind,
    insertText: undefined,
    detail: undefined,
    documentation: undefined,
    filterText: undefined,
    sortText: undefined,
  })),
  CompletionItemKind: {
    Snippet: 15,
  },
  SnippetString: vi.fn().mockImplementation((value) => ({ value })),
  MarkdownString: vi.fn().mockImplementation(() => ({
    appendText: vi.fn().mockReturnThis(),
    appendCodeblock: vi.fn().mockReturnThis(),
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

    it("should register completion provider", async () => {
      await integration.initialize();

      expect(
        vscode.languages.registerCompletionItemProvider
      ).toHaveBeenCalledWith(
        { scheme: "file" },
        expect.objectContaining({
          provideCompletionItems: expect.any(Function),
        })
      );
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

    it("should provide completions for matching language", async () => {
      const mockDocument = {
        languageId: "javascript",
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
        description: "test, utility",
      });
      expect(completions[0].detail).toBe("Snippet: Test Snippet");
    });

    it("should filter completions by language", async () => {
      const mockDocument = {
        languageId: "html",
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
        description: "html, template",
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
        description: "universal",
      });
    });

    it("should handle snippet manager errors gracefully", async () => {
      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: false,
        error: { message: "Failed to load snippets" },
      });

      const mockDocument = { languageId: "javascript" };
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
    it("should register snippet", async () => {
      const mockSnippet = {
        id: "test",
        title: "Test",
        code: "test",
        language: "javascript",
        tags: [],
        usageCount: 0,
      };

      await expect(
        integration.registerSnippet(mockSnippet as any)
      ).resolves.not.toThrow();
    });

    it("should unregister snippet", async () => {
      await expect(
        integration.unregisterSnippet("test-id")
      ).resolves.not.toThrow();
    });
  });

  describe("update snippet manager", () => {
    it("should update snippet manager reference", () => {
      const newSnippetManager = { test: "new manager" } as any;
      integration.updateSnippetManager(newSnippetManager);

      expect((integration as any).snippetManager).toBe(newSnippetManager);
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
