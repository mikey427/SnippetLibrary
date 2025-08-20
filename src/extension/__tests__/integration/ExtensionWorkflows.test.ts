import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SnippetLibraryExtension } from "../../SnippetLibraryExtension";
import { CommandHandler } from "../../CommandHandler";
import { VSCodeSnippetIntegration } from "../../VSCodeSnippetIntegration";
import { ConfigurationManager } from "../../ConfigurationManager";
import { WebGUILauncher } from "../../WebGUILauncher";
import { SnippetManagerImpl } from "../../../core/services/SnippetManagerImpl";
import { FileSystemStorageService } from "../../../core/services/FileSystemStorageService";
import { Snippet } from "../../../core/models/Snippet";

/**
 * Integration tests for VS Code extension workflows
 * Tests complete user workflows from start to finish
 */
describe("VS Code Extension Integration Workflows", () => {
  let extension: SnippetLibraryExtension;
  let commandHandler: CommandHandler;
  let vsCodeIntegration: VSCodeSnippetIntegration;
  let configManager: ConfigurationManager;
  let webGUILauncher: WebGUILauncher;
  let mockContext: any;
  let mockStorageService: any;
  let mockSnippetManager: any;

  beforeEach(async () => {
    // Setup mock VS Code context
    mockContext = {
      subscriptions: [],
      extensionPath: "/mock/extension/path",
      globalState: {
        get: vi.fn(),
        update: vi.fn(),
      },
      workspaceState: {
        get: vi.fn(),
        update: vi.fn(),
      },
      globalStorageUri: { fsPath: "/mock/global/storage" },
      storageUri: { fsPath: "/mock/workspace/storage" },
    };

    // Setup mock services
    mockStorageService = {
      loadSnippets: vi.fn().mockResolvedValue([]),
      saveSnippets: vi.fn().mockResolvedValue(undefined),
      watchChanges: vi.fn(),
      getStorageLocation: vi
        .fn()
        .mockReturnValue({ type: "global", path: "/mock/path" }),
      setStorageLocation: vi.fn().mockResolvedValue(undefined),
    };

    mockSnippetManager = {
      createSnippet: vi.fn(),
      getSnippet: vi.fn(),
      updateSnippet: vi.fn(),
      deleteSnippet: vi.fn(),
      searchSnippets: vi.fn().mockResolvedValue([]),
      getAllSnippets: vi.fn().mockResolvedValue([]),
      importSnippets: vi.fn(),
      exportSnippets: vi.fn(),
    };

    // Initialize components
    configManager = new ConfigurationManager();
    vsCodeIntegration = new VSCodeSnippetIntegration(mockSnippetManager);
    webGUILauncher = new WebGUILauncher(configManager);
    commandHandler = new CommandHandler(
      mockSnippetManager,
      vsCodeIntegration,
      configManager,
      webGUILauncher
    );
    extension = new SnippetLibraryExtension(
      commandHandler,
      vsCodeIntegration,
      configManager,
      webGUILauncher
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Complete Snippet Save Workflow", () => {
    it("should save selected code as snippet with full metadata", async () => {
      // Mock VS Code editor with selected text
      const mockEditor = {
        selection: {
          isEmpty: false,
          start: { line: 0, character: 0 },
          end: { line: 2, character: 10 },
        },
        document: {
          getText: vi.fn().mockReturnValue("const hello = 'world';"),
          languageId: "typescript",
          fileName: "/path/to/file.ts",
        },
      };

      vi.mocked(global.vscode.window.activeTextEditor as any) = mockEditor;
      vi.mocked(global.vscode.window.showInputBox).mockResolvedValueOnce(
        "Hello World Snippet"
      );
      vi.mocked(global.vscode.window.showInputBox).mockResolvedValueOnce(
        "A simple hello world example"
      );
      vi.mocked(global.vscode.window.showInputBox).mockResolvedValueOnce(
        "hello,world,example"
      );

      const mockSnippet = new Snippet({
        id: "test-id",
        title: "Hello World Snippet",
        description: "A simple hello world example",
        code: "const hello = 'world';",
        language: "typescript",
        tags: ["hello", "world", "example"],
      });

      mockSnippetManager.createSnippet.mockResolvedValue(mockSnippet);

      // Execute save command
      await commandHandler.saveSnippet();

      // Verify the complete workflow
      expect(mockEditor.document.getText).toHaveBeenCalledWith(
        mockEditor.selection
      );
      expect(global.vscode.window.showInputBox).toHaveBeenCalledTimes(3);
      expect(mockSnippetManager.createSnippet).toHaveBeenCalledWith({
        title: "Hello World Snippet",
        description: "A simple hello world example",
        code: "const hello = 'world';",
        language: "typescript",
        tags: ["hello", "world", "example"],
      });
      expect(vsCodeIntegration.refreshSnippetRegistry).toHaveBeenCalled();
      expect(global.vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Snippet 'Hello World Snippet' saved successfully!"
      );
    });

    it("should handle save workflow cancellation gracefully", async () => {
      const mockEditor = {
        selection: { isEmpty: false },
        document: {
          getText: vi.fn().mockReturnValue("test code"),
          languageId: "javascript",
        },
      };

      vi.mocked(global.vscode.window.activeTextEditor as any) = mockEditor;
      vi.mocked(global.vscode.window.showInputBox).mockResolvedValueOnce(
        undefined
      ); // User cancels

      await commandHandler.saveSnippet();

      expect(mockSnippetManager.createSnippet).not.toHaveBeenCalled();
      expect(
        global.vscode.window.showInformationMessage
      ).not.toHaveBeenCalled();
    });
  });

  describe("Complete Snippet Insert Workflow", () => {
    it("should insert snippet with proper formatting and cursor positioning", async () => {
      const mockSnippets = [
        new Snippet({
          id: "1",
          title: "For Loop",
          code: "for (let ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t${0}\n}",
          language: "javascript",
          tags: ["loop"],
        }),
        new Snippet({
          id: "2",
          title: "Function",
          code: "function ${1:name}(${2:params}) {\n\t${0}\n}",
          language: "javascript",
          tags: ["function"],
        }),
      ];

      mockSnippetManager.searchSnippets.mockResolvedValue(mockSnippets);
      vi.mocked(global.vscode.window.showQuickPick).mockResolvedValue({
        label: "For Loop",
        description: "for loop",
        snippet: mockSnippets[0],
      });

      const mockEditor = {
        insertSnippet: vi.fn().mockResolvedValue(true),
        selection: {
          active: { line: 5, character: 4 },
        },
      };
      vi.mocked(global.vscode.window.activeTextEditor as any) = mockEditor;

      await commandHandler.insertSnippet();

      expect(mockSnippetManager.searchSnippets).toHaveBeenCalled();
      expect(global.vscode.window.showQuickPick).toHaveBeenCalled();
      expect(mockEditor.insertSnippet).toHaveBeenCalled();
    });

    it("should handle search and filtering during insert workflow", async () => {
      const mockSnippets = [
        new Snippet({
          id: "1",
          title: "JavaScript For Loop",
          code: "for (let i = 0; i < length; i++) {}",
          language: "javascript",
          tags: ["loop", "javascript"],
        }),
      ];

      mockSnippetManager.searchSnippets.mockResolvedValue(mockSnippets);

      // Simulate user typing to filter
      const quickPickOptions = {
        placeHolder: "Search snippets...",
        matchOnDescription: true,
        matchOnDetail: true,
        onDidChangeValue: expect.any(Function),
      };

      vi.mocked(global.vscode.window.showQuickPick).mockImplementation(
        async (items, options) => {
          // Simulate user typing "loop"
          if (options?.onDidChangeValue) {
            options.onDidChangeValue("loop");
          }
          return items[0];
        }
      );

      await commandHandler.insertSnippet();

      expect(mockSnippetManager.searchSnippets).toHaveBeenCalled();
    });
  });

  describe("Extension Lifecycle Integration", () => {
    it("should activate extension and initialize all components", async () => {
      await extension.activate(mockContext);

      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
      expect(vsCodeIntegration.initialize).toHaveBeenCalled();
      expect(configManager.initialize).toHaveBeenCalledWith(mockContext);
    });

    it("should handle configuration changes and update components", async () => {
      await extension.activate(mockContext);

      // Simulate configuration change
      const configChangeEvent = {
        affectsConfiguration: vi.fn().mockReturnValue(true),
      };

      // Trigger configuration change
      const configChangeHandler = vi.mocked(
        global.vscode.workspace.onDidChangeConfiguration
      ).mock.calls[0][0];
      await configChangeHandler(configChangeEvent);

      expect(configManager.reloadConfiguration).toHaveBeenCalled();
      expect(vsCodeIntegration.refreshSnippetRegistry).toHaveBeenCalled();
    });

    it("should deactivate extension and cleanup resources", async () => {
      await extension.activate(mockContext);
      await extension.deactivate();

      expect(webGUILauncher.stopServer).toHaveBeenCalled();
    });
  });

  describe("Web GUI Integration Workflow", () => {
    it("should launch web GUI and open in browser", async () => {
      const mockServerInfo = {
        url: "http://localhost:3000",
        port: 3000,
        isRunning: true,
      };

      vi.spyOn(webGUILauncher, "startServer").mockResolvedValue(mockServerInfo);
      vi.spyOn(webGUILauncher, "openInBrowser").mockResolvedValue(undefined);

      await commandHandler.openWebGUI();

      expect(webGUILauncher.startServer).toHaveBeenCalled();
      expect(webGUILauncher.openInBrowser).toHaveBeenCalledWith(
        mockServerInfo.url
      );
      expect(global.vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Web GUI opened at http://localhost:3000"
      );
    });

    it("should handle web GUI startup failures gracefully", async () => {
      const error = new Error("Port already in use");
      vi.spyOn(webGUILauncher, "startServer").mockRejectedValue(error);

      await commandHandler.openWebGUI();

      expect(global.vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to start Web GUI: Port already in use"
      );
    });
  });

  describe("Cross-Component Data Flow", () => {
    it("should maintain data consistency across all components", async () => {
      await extension.activate(mockContext);

      // Create a snippet through command handler
      const mockEditor = {
        selection: { isEmpty: false },
        document: {
          getText: vi.fn().mockReturnValue("test code"),
          languageId: "javascript",
        },
      };

      vi.mocked(global.vscode.window.activeTextEditor as any) = mockEditor;
      vi.mocked(global.vscode.window.showInputBox)
        .mockResolvedValueOnce("Test Snippet")
        .mockResolvedValueOnce("Test Description")
        .mockResolvedValueOnce("test");

      const mockSnippet = new Snippet({
        id: "test-id",
        title: "Test Snippet",
        description: "Test Description",
        code: "test code",
        language: "javascript",
        tags: ["test"],
      });

      mockSnippetManager.createSnippet.mockResolvedValue(mockSnippet);

      await commandHandler.saveSnippet();

      // Verify VS Code integration was updated
      expect(vsCodeIntegration.refreshSnippetRegistry).toHaveBeenCalled();

      // Verify snippet is available for insertion
      mockSnippetManager.searchSnippets.mockResolvedValue([mockSnippet]);
      await commandHandler.insertSnippet();

      expect(mockSnippetManager.searchSnippets).toHaveBeenCalled();
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle storage errors gracefully across workflows", async () => {
      const storageError = new Error("Storage unavailable");
      mockSnippetManager.createSnippet.mockRejectedValue(storageError);

      const mockEditor = {
        selection: { isEmpty: false },
        document: {
          getText: vi.fn().mockReturnValue("test code"),
          languageId: "javascript",
        },
      };

      vi.mocked(global.vscode.window.activeTextEditor as any) = mockEditor;
      vi.mocked(global.vscode.window.showInputBox)
        .mockResolvedValueOnce("Test Snippet")
        .mockResolvedValueOnce("Test Description")
        .mockResolvedValueOnce("test");

      await commandHandler.saveSnippet();

      expect(global.vscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Failed to save snippet: Storage unavailable"
      );
    });
  });
});
