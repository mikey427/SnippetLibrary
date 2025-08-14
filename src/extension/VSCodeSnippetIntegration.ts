import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { SnippetManagerImpl } from "../core/services/SnippetManagerImpl";
import { SnippetInterface } from "../types";

/**
 * Handles integration with VS Code's native snippet system
 */
export class VSCodeSnippetIntegration {
  private snippetManager: SnippetManagerImpl;
  private disposables: vscode.Disposable[] = [];
  private snippetRegistryPath: string;
  private registeredSnippets: Map<string, any> = new Map();
  private fileWatcher?: vscode.FileSystemWatcher;

  constructor(snippetManager: SnippetManagerImpl) {
    this.snippetManager = snippetManager;
    this.snippetRegistryPath = this.getSnippetRegistryPath();
  }

  /**
   * Update the snippet manager reference (used when configuration changes)
   */
  updateSnippetManager(snippetManager: SnippetManagerImpl): void {
    this.snippetManager = snippetManager;
  }

  /**
   * Initialize VS Code snippet integration
   */
  async initialize(): Promise<void> {
    try {
      // Ensure snippet registry directory exists
      await this.ensureSnippetRegistryDirectory();

      // Register snippet completion provider
      await this.registerSnippetCompletionProvider();

      // Set up file system watcher for snippet changes
      await this.setupSnippetWatcher();

      // Initial snippet registration
      await this.refreshSnippets();

      // Register VS Code snippets
      await this.registerVSCodeSnippets();

      console.log("VS Code snippet integration initialized");
    } catch (error) {
      console.error("Failed to initialize VS Code snippet integration:", error);
      throw error;
    }
  }

  /**
   * Register completion provider for snippets
   */
  private async registerSnippetCompletionProvider(): Promise<void> {
    // Register completion provider for all languages with enhanced prefix triggering
    const completionProvider = vscode.languages.registerCompletionItemProvider(
      { scheme: "file" }, // Apply to all file schemes
      {
        provideCompletionItems: async (document, position, token, context) => {
          return this.provideSnippetCompletions(
            document,
            position,
            token,
            context
          );
        },
        resolveCompletionItem: async (item, token) => {
          return this.resolveSnippetCompletion(item, token);
        },
      },
      // Trigger characters for better prefix matching
      ".",
      "_",
      "-",
      "$",
      "@"
    );

    this.disposables.push(completionProvider);
  }

  /**
   * Provide snippet completions for IntelliSense
   */
  private async provideSnippetCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    try {
      // Get all snippets
      const result = await this.snippetManager.getAllSnippets();
      if (!result.success) {
        console.error(
          "Failed to get snippets for completion:",
          result.error.message
        );
        return [];
      }

      const snippets = result.data;
      const currentLanguage = document.languageId;

      // Get the current word being typed for better prefix matching
      const wordRange = document.getWordRangeAtPosition(position);
      const currentWord = wordRange ? document.getText(wordRange) : "";

      // Filter snippets by language and scope
      const relevantSnippets = snippets.filter((snippet) => {
        // Include if language matches or no specific language requirement
        const languageMatch =
          snippet.language === currentLanguage ||
          snippet.language === "plaintext";

        // Include if scope matches or no scope specified
        const scopeMatch =
          !snippet.scope ||
          snippet.scope.length === 0 ||
          snippet.scope.includes(currentLanguage);

        // Enhanced prefix matching
        const prefixMatch =
          currentWord === "" ||
          snippet.prefix?.toLowerCase().startsWith(currentWord.toLowerCase()) ||
          snippet.title.toLowerCase().includes(currentWord.toLowerCase()) ||
          snippet.tags.some((tag) =>
            tag.toLowerCase().includes(currentWord.toLowerCase())
          );

        return languageMatch && scopeMatch && prefixMatch;
      });

      // Convert snippets to completion items
      const completionItems: vscode.CompletionItem[] = relevantSnippets.map(
        (snippet) => {
          const prefix =
            snippet.prefix || snippet.title.toLowerCase().replace(/\s+/g, "");
          const item = new vscode.CompletionItem(
            prefix,
            vscode.CompletionItemKind.Snippet
          );

          // Set the snippet content
          item.insertText = new vscode.SnippetString(snippet.code);

          // Set additional properties
          item.detail = `Snippet: ${snippet.title}`;
          item.documentation = new vscode.MarkdownString()
            .appendText(snippet.description || "No description")
            .appendCodeblock(snippet.code, snippet.language);

          // Enhanced filter text for better matching
          item.filterText = `${prefix} ${snippet.title} ${snippet.tags.join(
            " "
          )}`;

          // Set sort text to prioritize by usage and prefix match
          const prefixMatchScore = snippet.prefix
            ?.toLowerCase()
            .startsWith(currentWord.toLowerCase())
            ? 0
            : 100;
          const usageScore = 1000 - snippet.usageCount;
          item.sortText =
            String(prefixMatchScore + usageScore).padStart(6, "0") +
            snippet.title;

          // Enhanced label with tags and usage info
          if (snippet.tags.length > 0) {
            item.label = {
              label: prefix,
              description: `${snippet.tags.slice(0, 2).join(", ")} (${
                snippet.usageCount
              } uses)`,
            };
          } else {
            item.label = {
              label: prefix,
              description: `${snippet.usageCount} uses`,
            };
          }

          // Add commit characters for better UX
          item.commitCharacters = [" ", "\t"];

          // Store snippet ID for usage tracking
          item.command = {
            command: "snippetLibrary.trackUsage",
            title: "Track Usage",
            arguments: [snippet.id],
          };

          return item;
        }
      );

      return completionItems;
    } catch (error) {
      console.error("Error providing snippet completions:", error);
      return [];
    }
  }

  /**
   * Resolve completion item with additional details
   */
  private async resolveSnippetCompletion(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): Promise<vscode.CompletionItem> {
    try {
      // Add additional documentation or modify the item if needed
      if (item.documentation instanceof vscode.MarkdownString) {
        item.documentation.appendMarkdown("\n\n*Press Tab to insert snippet*");
      }

      return item;
    } catch (error) {
      console.error("Error resolving snippet completion:", error);
      return item;
    }
  }

  /**
   * Refresh VS Code snippet registrations
   */
  async refreshSnippets(): Promise<void> {
    try {
      // Get all snippets
      const result = await this.snippetManager.getAllSnippets();
      if (!result.success) {
        console.error("Failed to refresh snippets:", result.error.message);
        return;
      }

      const snippets = result.data;
      console.log(
        `Refreshed ${snippets.length} snippets for VS Code integration`
      );

      // Update VS Code snippet registry
      await this.registerVSCodeSnippets();
    } catch (error) {
      console.error("Error refreshing VS Code snippets:", error);
    }
  }

  /**
   * Register a single snippet with VS Code
   */
  async registerSnippet(snippet: SnippetInterface): Promise<void> {
    try {
      // Add to registered snippets map
      const vscodeSnippet = this.createVSCodeSnippetDefinition(snippet);
      this.registeredSnippets.set(snippet.id, vscodeSnippet);

      // Update VS Code snippet registry
      await this.registerVSCodeSnippets();

      console.log(
        `Snippet "${snippet.title}" registered for VS Code integration`
      );
    } catch (error) {
      console.error(`Failed to register snippet "${snippet.title}":`, error);
    }
  }

  /**
   * Unregister a snippet from VS Code
   */
  async unregisterSnippet(snippetId: string): Promise<void> {
    try {
      // Remove from registered snippets map
      this.registeredSnippets.delete(snippetId);

      // Update VS Code snippet registry
      await this.registerVSCodeSnippets();

      console.log(`Snippet ${snippetId} unregistered from VS Code integration`);
    } catch (error) {
      console.error(`Failed to unregister snippet ${snippetId}:`, error);
    }
  }

  /**
   * Get snippet suggestions for a given context
   */
  async getSnippetSuggestions(
    language: string,
    prefix?: string
  ): Promise<SnippetInterface[]> {
    try {
      const result = await this.snippetManager.getAllSnippets();
      if (!result.success) {
        return [];
      }

      let snippets = result.data;

      // Filter by language
      snippets = snippets.filter(
        (snippet) =>
          snippet.language === language ||
          snippet.language === "plaintext" ||
          (snippet.scope && snippet.scope.includes(language))
      );

      // Filter by prefix if provided
      if (prefix) {
        snippets = snippets.filter(
          (snippet) =>
            snippet.prefix?.startsWith(prefix) ||
            snippet.title.toLowerCase().includes(prefix.toLowerCase()) ||
            snippet.tags.some((tag) =>
              tag.toLowerCase().includes(prefix.toLowerCase())
            )
        );
      }

      // Sort by usage count (most used first)
      snippets.sort((a, b) => b.usageCount - a.usageCount);

      return snippets;
    } catch (error) {
      console.error("Error getting snippet suggestions:", error);
      return [];
    }
  }

  /**
   * Get the path to VS Code snippet registry directory
   */
  private getSnippetRegistryPath(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return path.join(workspaceFolder.uri.fsPath, ".vscode", "snippets");
    } else {
      // Use global snippets directory
      const userDataPath = vscode.env.appRoot;
      return path.join(userDataPath, "User", "snippets");
    }
  }

  /**
   * Ensure snippet registry directory exists
   */
  private async ensureSnippetRegistryDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.snippetRegistryPath)) {
        fs.mkdirSync(this.snippetRegistryPath, { recursive: true });
      }
    } catch (error) {
      console.error("Failed to create snippet registry directory:", error);
    }
  }

  /**
   * Set up file system watcher for snippet changes
   */
  private async setupSnippetWatcher(): Promise<void> {
    try {
      // Watch for changes in snippet manager
      const result = await this.snippetManager.getAllSnippets();
      if (result.success) {
        // Set up periodic refresh to catch external changes
        const refreshInterval = setInterval(async () => {
          await this.refreshSnippets();
        }, 30000); // Refresh every 30 seconds

        this.disposables.push({
          dispose: () => clearInterval(refreshInterval),
        });
      }
    } catch (error) {
      console.error("Failed to set up snippet watcher:", error);
    }
  }

  /**
   * Register all snippets with VS Code's snippet system
   */
  private async registerVSCodeSnippets(): Promise<void> {
    try {
      // Get all snippets from manager
      const result = await this.snippetManager.getAllSnippets();
      if (!result.success) {
        console.error(
          "Failed to get snippets for VS Code registration:",
          result.error.message
        );
        return;
      }

      const snippets = result.data;

      // Group snippets by language
      const snippetsByLanguage = new Map<string, any>();

      snippets.forEach((snippet) => {
        const language = snippet.language || "plaintext";

        if (!snippetsByLanguage.has(language)) {
          snippetsByLanguage.set(language, {});
        }

        const languageSnippets = snippetsByLanguage.get(language);
        const snippetKey =
          snippet.prefix || snippet.title.toLowerCase().replace(/\s+/g, "-");

        languageSnippets[snippetKey] = {
          prefix:
            snippet.prefix || snippet.title.toLowerCase().replace(/\s+/g, ""),
          body: snippet.code.split("\n"),
          description: snippet.description || snippet.title,
          scope: snippet.scope?.join(",") || language,
        };
      });

      // Write snippet files for each language
      for (const [language, languageSnippets] of snippetsByLanguage) {
        const snippetFilePath = path.join(
          this.snippetRegistryPath,
          `snippet-library-${language}.code-snippets`
        );

        const snippetFileContent = JSON.stringify(languageSnippets, null, 2);

        try {
          fs.writeFileSync(snippetFilePath, snippetFileContent, "utf8");
          console.log(
            `Updated VS Code snippets for ${language}: ${snippetFilePath}`
          );
        } catch (error) {
          console.error(`Failed to write snippet file for ${language}:`, error);
        }
      }

      // Clean up old snippet files that are no longer needed
      await this.cleanupOldSnippetFiles(snippetsByLanguage);
    } catch (error) {
      console.error("Failed to register VS Code snippets:", error);
    }
  }

  /**
   * Clean up old snippet files that are no longer needed
   */
  private async cleanupOldSnippetFiles(
    currentLanguages: Map<string, any>
  ): Promise<void> {
    try {
      if (!fs.existsSync(this.snippetRegistryPath)) {
        return;
      }

      const files = fs.readdirSync(this.snippetRegistryPath);
      const snippetLibraryFiles = files.filter(
        (file) =>
          file.startsWith("snippet-library-") && file.endsWith(".code-snippets")
      );

      for (const file of snippetLibraryFiles) {
        const language = file
          .replace("snippet-library-", "")
          .replace(".code-snippets", "");

        if (!currentLanguages.has(language)) {
          const filePath = path.join(this.snippetRegistryPath, file);
          try {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old snippet file: ${filePath}`);
          } catch (error) {
            console.error(
              `Failed to clean up snippet file ${filePath}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to cleanup old snippet files:", error);
    }
  }

  /**
   * Create VS Code snippet definition from our snippet
   */
  private createVSCodeSnippetDefinition(snippet: SnippetInterface): any {
    return {
      [snippet.title]: {
        prefix:
          snippet.prefix || snippet.title.toLowerCase().replace(/\s+/g, ""),
        body: snippet.code.split("\n"),
        description: snippet.description || snippet.title,
        scope: snippet.scope?.join(",") || snippet.language,
      },
    };
  }

  /**
   * Handle snippet manager changes and update VS Code registry
   */
  async onSnippetChange(
    changeType: "created" | "updated" | "deleted",
    snippet: SnippetInterface
  ): Promise<void> {
    try {
      switch (changeType) {
        case "created":
        case "updated":
          await this.registerSnippet(snippet);
          break;
        case "deleted":
          await this.unregisterSnippet(snippet.id);
          break;
      }
    } catch (error) {
      console.error(`Failed to handle snippet change (${changeType}):`, error);
    }
  }

  /**
   * Get all registered VS Code snippets
   */
  getRegisteredSnippets(): Map<string, any> {
    return new Map(this.registeredSnippets);
  }

  /**
   * Force refresh of all VS Code snippet registrations
   */
  async forceRefresh(): Promise<void> {
    try {
      this.registeredSnippets.clear();
      await this.refreshSnippets();
      console.log("Force refresh of VS Code snippet integration completed");
    } catch (error) {
      console.error(
        "Failed to force refresh VS Code snippet integration:",
        error
      );
    }
  }

  /**
   * Dispose of all resources
   */
  async dispose(): Promise<void> {
    console.log("Disposing VS Code snippet integration resources...");

    try {
      // Dispose file watcher
      if (this.fileWatcher) {
        this.fileWatcher.dispose();
      }

      // Dispose all other resources
      this.disposables.forEach((disposable) => {
        try {
          disposable.dispose();
        } catch (error) {
          console.error("Error disposing VS Code integration resource:", error);
        }
      });

      this.disposables = [];
      this.registeredSnippets.clear();

      console.log("VS Code snippet integration disposed");
    } catch (error) {
      console.error("Error during VS Code integration disposal:", error);
    }
  }
}
