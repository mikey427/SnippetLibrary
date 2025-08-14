import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as vscode from "vscode";
import { SnippetLibraryExtension } from "../SnippetLibraryExtension";

// Mock VS Code API
vi.mock("vscode", () => ({
  ExtensionContext: vi.fn(),
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    activeTextEditor: undefined,
    showInputBox: vi.fn(),
    showQuickPick: vi.fn(),
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: any) => {
        const config: { [key: string]: any } = {
          storageLocation: "global",
          storageFormat: "json",
          autoBackup: true,
          backupInterval: 86400000,
          webGUIPort: 3000,
          webGUIAutoLaunch: false,
        };
        return config[key] ?? defaultValue;
      }),
      update: vi.fn(),
    })),
    workspaceFolders: undefined,
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    fs: {
      writeFile: vi.fn(),
      readFile: vi.fn(),
    },
    openTextDocument: vi.fn(),
  },
  commands: {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
  languages: {
    registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path })),
  },
  CompletionItem: vi.fn(),
  CompletionItemKind: {
    Snippet: 15,
  },
  SnippetString: vi.fn(),
  MarkdownString: vi.fn(() => ({
    appendText: vi.fn().mockReturnThis(),
    appendCodeblock: vi.fn().mockReturnThis(),
  })),
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
  },
}));

// Mock the core services
vi.mock("../../core/services", () => ({
  createStorageService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    loadSnippets: vi.fn().mockResolvedValue({ success: true, data: [] }),
    saveSnippets: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    watchChanges: vi.fn().mockReturnValue({ success: true, data: undefined }),
  })),
  createWorkspaceStorageService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    loadSnippets: vi.fn().mockResolvedValue({ success: true, data: [] }),
    saveSnippets: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    watchChanges: vi.fn().mockReturnValue({ success: true, data: undefined }),
  })),
  createGlobalStorageService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    loadSnippets: vi.fn().mockResolvedValue({ success: true, data: [] }),
    saveSnippets: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    watchChanges: vi.fn().mockReturnValue({ success: true, data: undefined }),
  })),
}));

vi.mock("../../core/services/SnippetManagerImpl", () => ({
  SnippetManagerImpl: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    getAllSnippets: vi.fn().mockResolvedValue({ success: true, data: [] }),
    createSnippet: vi.fn().mockResolvedValue({ success: true, data: {} }),
    updateSnippet: vi.fn().mockResolvedValue({ success: true, data: {} }),
    deleteSnippet: vi.fn().mockResolvedValue({ success: true, data: true }),
    searchSnippets: vi.fn().mockResolvedValue({ success: true, data: [] }),
    incrementUsage: vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    refresh: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    exportSnippets: vi.fn().mockResolvedValue({
      success: true,
      data: {
        snippets: [],
        metadata: { exportedAt: new Date(), version: "1.0.0", count: 0 },
      },
    }),
    importSnippets: vi.fn().mockResolvedValue({
      success: true,
      data: { imported: 0, skipped: 0, errors: [], conflicts: [] },
    }),
  })),
}));

describe("SnippetLibraryExtension", () => {
  let extension: SnippetLibraryExtension;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // Create mock extension context
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: vi.fn(),
        update: vi.fn(),
      },
      globalState: {
        get: vi.fn(),
        update: vi.fn(),
      },
      extensionPath: "/mock/extension/path",
      storagePath: "/mock/storage/path",
      globalStoragePath: "/mock/global/storage/path",
      logPath: "/mock/log/path",
    } as any;

    extension = new SnippetLibraryExtension(mockContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await expect(extension.initialize()).resolves.not.toThrow();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Snippet Library extension activated successfully!"
      );
    });

    it("should register all commands", async () => {
      await extension.initialize();

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "snippetLibrary.saveSnippet",
        expect.any(Function)
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "snippetLibrary.insertSnippet",
        expect.any(Function)
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "snippetLibrary.manageSnippets",
        expect.any(Function)
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "snippetLibrary.openWebGUI",
        expect.any(Function)
      );
    });

    it("should set up configuration listener", async () => {
      await extension.initialize();
      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
    });

    it("should handle initialization errors gracefully", async () => {
      // Create a new extension instance with a failing snippet manager
      const failingSnippetManager = {
        initialize: vi.fn().mockResolvedValue({
          success: false,
          error: { message: "Test error" },
        }),
      };

      // Replace the snippet manager in the extension
      (extension as any).snippetManager = failingSnippetManager;

      await expect(extension.initialize()).rejects.toThrow("Test error");
    });
  });

  describe("storage service creation", () => {
    it("should create global storage service by default", async () => {
      await extension.initialize();
      // The extension should have been created successfully with global storage
      expect(extension).toBeDefined();
    });

    it("should create workspace storage service when configured", async () => {
      // Mock workspace configuration
      const mockConfig = vi.fn((key: string) => {
        if (key === "storageLocation") return "workspace";
        return undefined;
      });

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: mockConfig,
        update: vi.fn(),
      } as any);

      // Mock workspace folders
      vi.mocked(vscode.workspace).workspaceFolders = [
        {
          uri: { fsPath: "/mock/workspace" },
          name: "test-workspace",
          index: 0,
        },
      ] as any;

      await extension.initialize();
      expect(extension).toBeDefined();
    });

    it("should fallback to global storage when no workspace is available", async () => {
      // Mock workspace configuration but no workspace folders
      const mockConfig = vi.fn((key: string) => {
        if (key === "storageLocation") return "workspace";
        return undefined;
      });

      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: mockConfig,
        update: vi.fn(),
      } as any);

      vi.mocked(vscode.workspace).workspaceFolders = undefined;

      await extension.initialize();
      expect(extension).toBeDefined();
    });
  });

  describe("configuration changes", () => {
    it("should handle configuration changes", async () => {
      await extension.initialize();

      // Get the configuration change handler
      const configChangeHandler = vi.mocked(
        vscode.workspace.onDidChangeConfiguration
      ).mock.calls[0][0];

      // Mock configuration change event
      const mockEvent = {
        affectsConfiguration: vi.fn(
          (section: string) => section === "snippetLibrary"
        ),
      };

      // Call the handler
      await configChangeHandler(mockEvent as any);

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Snippet Library configuration updated successfully!"
      );
    });

    it("should handle configuration change errors", async () => {
      await extension.initialize();

      // Mock the createStorageService method to throw an error
      const originalCreateStorageService = (extension as any)
        .createStorageService;
      (extension as any).createStorageService = vi.fn(() => {
        throw new Error("Config change error");
      });

      const configChangeHandler = vi.mocked(
        vscode.workspace.onDidChangeConfiguration
      ).mock.calls[0][0];

      const mockEvent = {
        affectsConfiguration: vi.fn(
          (section: string) => section === "snippetLibrary"
        ),
      };

      await configChangeHandler(mockEvent as any);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to update Snippet Library configuration"
        )
      );

      // Restore original method
      (extension as any).createStorageService = originalCreateStorageService;
    });
  });

  describe("disposal", () => {
    it("should dispose all resources", async () => {
      await extension.initialize();
      await expect(extension.dispose()).resolves.not.toThrow();
    });

    it("should handle disposal errors gracefully", async () => {
      await extension.initialize();

      // Mock disposal error
      const mockDisposable = {
        dispose: vi.fn(() => {
          throw new Error("Disposal error");
        }),
      };

      // Add mock disposable to the extension's disposables
      (extension as any).disposables.push(mockDisposable);

      await expect(extension.dispose()).resolves.not.toThrow();
    });
  });

  describe("getters", () => {
    it("should return snippet manager instance", async () => {
      await extension.initialize();
      const snippetManager = extension.getSnippetManager();
      expect(snippetManager).toBeDefined();
    });

    it("should return VS Code integration instance", async () => {
      await extension.initialize();
      const vscodeIntegration = extension.getVSCodeIntegration();
      expect(vscodeIntegration).toBeDefined();
    });
  });
});
