import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as vscode from "vscode";
import { CommandHandler } from "../CommandHandler";
import { ConfigurationManager } from "../ConfigurationManager";
import { SnippetInterface } from "../../types";

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
  ViewColumn: {
    Beside: 2,
  },
  commands: {
    executeCommand: vi.fn(),
  },
}));

describe("Snippet Save and Insert Functionality", () => {
  let commandHandler: CommandHandler;
  let mockSnippetManager: any;
  let mockConfigManager: ConfigurationManager;
  let mockEditor: any;

  beforeEach(() => {
    // Create mock snippet manager
    mockSnippetManager = {
      createSnippet: vi.fn().mockResolvedValue({
        success: true,
        data: { id: "test-id", title: "Test Snippet" },
      }),
      getAllSnippets: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: "1",
            title: "Console Log",
            description: "Log to console",
            code: "console.log(${1:message});$0",
            language: "javascript",
            tags: ["debug", "utility"],
            category: "logging",
            usageCount: 5,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            prefix: "log",
          },
          {
            id: "2",
            title: "Function Template",
            description: "Basic function template",
            code: "function ${1:functionName}(${2:params}) {\n  ${3:// implementation}\n  return ${4:result};\n}$0",
            language: "javascript",
            tags: ["function", "template"],
            category: "templates",
            usageCount: 10,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
            prefix: "func",
          },
        ],
      }),
      incrementUsage: vi
        .fn()
        .mockResolvedValue({ success: true, data: undefined }),
    };

    // Create mock editor
    mockEditor = {
      selection: {
        isEmpty: false,
        active: { line: 2, character: 4 },
      },
      document: {
        languageId: "javascript",
        getText: vi.fn().mockReturnValue("console.log('test');"),
        lineAt: vi.fn().mockReturnValue({ text: "    " }), // 4 spaces indentation
      },
      insertSnippet: vi.fn(),
    };

    mockConfigManager = new ConfigurationManager();
    commandHandler = new CommandHandler(mockSnippetManager, mockConfigManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Enhanced Save Snippet", () => {
    beforeEach(() => {
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;
    });

    it("should save snippet with auto-enhancement", async () => {
      // Mock user inputs
      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce("Test Function") // title
        .mockResolvedValueOnce("A test function") // description
        .mockResolvedValueOnce("test, function") // tags
        .mockResolvedValueOnce("utilities") // category
        .mockResolvedValueOnce("testfunc"); // prefix

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        value: "auto",
      } as any);

      mockEditor.document.getText.mockReturnValue(
        "function testFunc(param) { return param; }"
      );

      await commandHandler.saveSnippet();

      expect(mockSnippetManager.createSnippet).toHaveBeenCalledWith({
        title: "Test Function",
        description: "A test function",
        code: expect.stringContaining("${1:testFunc}"), // Should have tab stops
        language: "javascript",
        tags: ["test", "function"],
        category: "utilities",
        prefix: "testfunc",
      });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Snippet "Test Function" saved successfully!'
      );
    });

    it("should save snippet with manual enhancement", async () => {
      // Mock user inputs
      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce("Manual Snippet") // title
        .mockResolvedValueOnce("") // description (empty)
        .mockResolvedValueOnce("") // tags (empty)
        .mockResolvedValueOnce("") // category (empty)
        .mockResolvedValueOnce(""); // prefix (empty)

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        value: "manual",
      } as any);

      // Mock the manual enhancement flow
      const mockDoc = {
        getText: vi
          .fn()
          .mockReturnValue(
            "enhanced code with ${1:placeholder}$0\n\n// Add tab stops using ${1:placeholder} syntax\n// Use $0 for final cursor position"
          ),
      };
      const mockEnhancedEditor = {
        ...mockEditor,
        document: mockDoc,
      };
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(
        mockDoc as any
      );
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue(
        mockEnhancedEditor as any
      );
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue("Done");

      await commandHandler.saveSnippet();

      expect(mockSnippetManager.createSnippet).toHaveBeenCalledWith({
        title: "Manual Snippet",
        description: "",
        code: "enhanced code with ${1:placeholder}$0",
        language: "javascript",
        tags: [],
        category: undefined,
        prefix: undefined,
      });
    });

    it("should save snippet without enhancement", async () => {
      // Mock user inputs
      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce("Plain Snippet") // title
        .mockResolvedValueOnce("Plain description") // description
        .mockResolvedValueOnce("") // tags (empty)
        .mockResolvedValueOnce("") // category (empty)
        .mockResolvedValueOnce(""); // prefix (empty)

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        value: "none",
      } as any);

      const originalCode = "const x = 'test';";
      mockEditor.document.getText.mockReturnValue(originalCode);

      await commandHandler.saveSnippet();

      expect(mockSnippetManager.createSnippet).toHaveBeenCalledWith({
        title: "Plain Snippet",
        description: "Plain description",
        code: originalCode, // Should be unchanged
        language: "javascript",
        tags: [],
        category: undefined,
        prefix: undefined,
      });
    });

    it("should handle cancellation during enhancement selection", async () => {
      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce("Test") // title
        .mockResolvedValueOnce("") // description
        .mockResolvedValueOnce("") // tags
        .mockResolvedValueOnce("") // category
        .mockResolvedValueOnce(""); // prefix

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined); // User cancels

      await commandHandler.saveSnippet();

      expect(mockSnippetManager.createSnippet).not.toHaveBeenCalled();
    });

    it("should handle cancellation during manual enhancement", async () => {
      vi.mocked(vscode.window.showInputBox)
        .mockResolvedValueOnce("Test") // title
        .mockResolvedValueOnce("") // description
        .mockResolvedValueOnce("") // tags
        .mockResolvedValueOnce("") // category
        .mockResolvedValueOnce(""); // prefix

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        value: "manual",
      } as any);

      // Mock manual enhancement cancellation
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as any);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue(
        mockEditor as any
      );
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(
        "Cancel"
      );

      await commandHandler.saveSnippet();

      expect(mockSnippetManager.createSnippet).not.toHaveBeenCalled();
    });
  });

  describe("Enhanced Insert Snippet", () => {
    beforeEach(() => {
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;
    });

    it("should show enhanced snippet picker with previews", async () => {
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        snippet: {
          id: "1",
          title: "Console Log",
          description: "Log to console",
          code: "console.log(${1:message});$0",
          language: "javascript",
          tags: ["debug", "utility"],
          usageCount: 5,
        },
      } as any);

      // Mock preview confirmation
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as any);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any);
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(
        "Insert"
      );

      await commandHandler.insertSnippet();

      // Verify enhanced quick pick was called with proper formatting
      const quickPickCall = vi.mocked(vscode.window.showQuickPick).mock
        .calls[0];
      const items = quickPickCall[0] as any[];

      expect(items[0].label).toContain("$(file-code)");
      expect(items[0].label).toContain("Function Template"); // Higher usage count comes first
      expect(items[0].description).toContain("javascript");
      expect(items[0].description).toContain("function, template");
      expect(items[0].description).toContain("Used 10 times");
      expect(items[0].detail).toContain("Basic function template");
    });

    it("should filter and sort snippets by relevance", async () => {
      mockEditor.document.languageId = "javascript";

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        snippet: {
          id: "2",
          title: "Function Template",
          description: "Basic function template",
          code: "function ${1:functionName}(${2:params}) {\n  ${3:// implementation}\n  return ${4:result};\n}$0",
          language: "javascript",
          tags: ["function", "template"],
        },
      } as any);

      // Mock preview confirmation
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as any);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any);
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(
        "Insert"
      );

      await commandHandler.insertSnippet();

      // Verify snippets are sorted by relevance (JavaScript snippets first, then by usage)
      const quickPickCall = vi.mocked(vscode.window.showQuickPick).mock
        .calls[0];
      const items = quickPickCall[0] as any[];

      // Function Template should come first (higher usage count)
      expect(items[0].snippet.title).toBe("Function Template");
      expect(items[1].snippet.title).toBe("Console Log");
    });

    it("should show snippet preview before insertion", async () => {
      const selectedSnippet = {
        id: "1",
        title: "Console Log",
        description: "Log to console",
        code: "console.log(${1:message});$0",
        language: "javascript",
        tags: ["debug"],
      };

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        snippet: selectedSnippet,
      } as any);

      // Mock preview document
      const mockPreviewDoc = {};
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(
        mockPreviewDoc as any
      );
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any);
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(
        "Insert"
      );

      await commandHandler.insertSnippet();

      // Verify preview document was created with proper content
      const openDocCall = vi.mocked(vscode.workspace.openTextDocument).mock
        .calls[0];
      const docOptions = openDocCall[0] as any;

      expect(docOptions.content).toContain("// Snippet: Console Log");
      expect(docOptions.content).toContain("// Language: javascript");
      expect(docOptions.content).toContain("// Description: Log to console");
      expect(docOptions.content).toContain("// Tags: debug");
      expect(docOptions.content).toContain("console.log(${1:message});$0");
      expect(docOptions.language).toBe("javascript");

      // Verify preview was shown beside current editor
      const showDocCall = vi.mocked(vscode.window.showTextDocument).mock
        .calls[0];
      const showOptions = showDocCall[1] as any;
      expect(showOptions.viewColumn).toBe(vscode.ViewColumn.Beside);
      expect(showOptions.preview).toBe(true);
    });

    it("should handle proper indentation when inserting snippet", async () => {
      const selectedSnippet = {
        id: "1",
        title: "Multi-line Snippet",
        description: "Multi-line code block",
        code: "if (condition) {\n  doSomething();\n  doMore();\n}",
        language: "javascript",
        tags: ["control", "flow"],
      };

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        snippet: selectedSnippet,
      } as any);

      // Mock preview confirmation
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as any);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any);
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(
        "Insert"
      );

      // Mock current line with indentation
      mockEditor.document.lineAt.mockReturnValue({ text: "    " }); // 4 spaces

      await commandHandler.insertSnippet();

      // Verify insertSnippet was called
      expect(mockEditor.insertSnippet).toHaveBeenCalled();

      // Verify usage was incremented
      expect(mockSnippetManager.incrementUsage).toHaveBeenCalledWith("1");

      // Verify success message
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Inserted "Multi-line Snippet"')
      );
    });

    it("should handle preview cancellation", async () => {
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        snippet: {
          id: "1",
          title: "Test Snippet",
          description: "Test snippet",
          code: "test code",
          language: "javascript",
          tags: ["test"],
        },
      } as any);

      // Mock preview cancellation
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as any);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue({} as any);
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(
        "Cancel"
      );

      await commandHandler.insertSnippet();

      // Verify snippet was not inserted
      expect(mockEditor.insertSnippet).not.toHaveBeenCalled();
      expect(mockSnippetManager.incrementUsage).not.toHaveBeenCalled();
    });

    it("should handle snippet selection cancellation", async () => {
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined); // User cancels

      await commandHandler.insertSnippet();

      expect(mockEditor.insertSnippet).not.toHaveBeenCalled();
      expect(mockSnippetManager.incrementUsage).not.toHaveBeenCalled();
    });
  });

  describe("Snippet Processing", () => {
    it("should process snippet syntax correctly", async () => {
      const commandHandlerAny = commandHandler as any;

      // Test various snippet syntax patterns
      const testCases = [
        {
          input: "console.log(${VARIABLE});",
          expected: "console.log(${1:VARIABLE});$0",
        },
        {
          input: "function {{functionName}}() { return [value]; }",
          expected: "function ${1:functionName}() { return ${1:value}; }$0",
        },
        {
          input: "const name = 'VALUE';",
          expected: "const name = 'VALUE';$0",
        },
      ];

      testCases.forEach((testCase) => {
        const result = commandHandlerAny.processSnippetSyntax(testCase.input);
        // Should have tab stops (either numbered or final)
        expect(result).toMatch(/\$\{\d+:|\$0/);
        if (testCase.expected.includes("${1:")) {
          expect(result).toMatch(/\$\{\d+:/); // Should have numbered tab stops
        }
      });
    });

    it("should handle indentation correctly", async () => {
      const commandHandlerAny = commandHandler as any;

      const testCases = [
        { input: "", expected: "" },
        { input: "    code", expected: "    " },
        { input: "\t\tcode", expected: "\t\t" },
        { input: "  \t  code", expected: "  \t  " },
        { input: "noindent", expected: "" },
      ];

      testCases.forEach((testCase) => {
        const result = commandHandlerAny.getIndentation(testCase.input);
        expect(result).toBe(testCase.expected);
      });
    });

    it("should auto-enhance snippets correctly", async () => {
      const commandHandlerAny = commandHandler as any;

      const testCases = [
        {
          input: "function testFunc(param) { return param; }",
          shouldContain: ["${1:testFunc}", "${1:param}"],
        },
        {
          input: "class MyClass { constructor() {} }",
          shouldContain: ["${1:MyClass}"],
        },
        {
          input: "const variable = 'VALUE';",
          shouldContain: ["${2:value}"],
        },
      ];

      testCases.forEach((testCase) => {
        const result = commandHandlerAny.autoEnhanceSnippet(testCase.input);
        testCase.shouldContain.forEach((pattern) => {
          expect(result).toContain(pattern);
        });
        expect(result).toMatch(/\$0|\$\{\d+/); // Should have tab stops
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle snippet manager errors during save", async () => {
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;

      vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce("Test");
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        value: "none",
      } as any);

      mockSnippetManager.createSnippet.mockResolvedValue({
        success: false,
        error: { message: "Storage error" },
      });

      await commandHandler.saveSnippet();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to save snippet: Storage error"
      );
    });

    it("should handle snippet manager errors during insert", async () => {
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;

      mockSnippetManager.getAllSnippets.mockResolvedValue({
        success: false,
        error: { message: "Load error" },
      });

      await commandHandler.insertSnippet();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to load snippets: Load error"
      );
    });

    it("should handle unexpected errors gracefully", async () => {
      vi.mocked(vscode.window).activeTextEditor = mockEditor as any;

      // Mock an unexpected error
      mockSnippetManager.getAllSnippets.mockRejectedValue(
        new Error("Unexpected error")
      );

      await commandHandler.insertSnippet();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("Error inserting snippet: Unexpected error")
      );
    });
  });
});
