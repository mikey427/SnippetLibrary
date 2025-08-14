import * as vscode from "vscode";
import { SnippetManagerImpl } from "../core/services/SnippetManagerImpl";
import { SnippetInterface } from "../types";

/**
 * Handles integration with VS Code's native snippet system
 */
export class VSCodeSnippetIntegration {
  private snippetManager: SnippetManagerImpl;
  private disposables: vscode.Disposable[] = [];

  constructor(snippetManager: SnippetManagerImpl) {
    this.snippetManager = snippetManager;
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
      // Register snippet completion provider
      await this.registerSnippetCompletionProvider();

      // Initial snippet registration
      await this.refreshSnippets();

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
    // Register completion provider for all languages
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
      }
      // Trigger characters - none specified means it will trigger on any character
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

        return languageMatch && scopeMatch;
      });

      // Convert snippets to completion items
      const completionItems: vscode.CompletionItem[] = relevantSnippets.map(
        (snippet) => {
          const item = new vscode.CompletionItem(
            snippet.prefix || snippet.title,
            vscode.CompletionItemKind.Snippet
          );

          // Set the snippet content
          item.insertText = new vscode.SnippetString(snippet.code);

          // Set additional properties
          item.detail = `Snippet: ${snippet.title}`;
          item.documentation = new vscode.MarkdownString()
            .appendText(snippet.description || "No description")
            .appendCodeblock(snippet.code, snippet.language);

          // Set filter text for better matching
          item.filterText = `${snippet.title} ${
            snippet.prefix || ""
          } ${snippet.tags.join(" ")}`;

          // Set sort text to prioritize by usage
          item.sortText =
            String(1000 - snippet.usageCount).padStart(4, "0") + snippet.title;

          // Add tags to the label if available
          if (snippet.tags.length > 0) {
            item.label = {
              label: snippet.prefix || snippet.title,
              description: snippet.tags.slice(0, 3).join(", "),
            };
          }

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

      // Note: VS Code doesn't provide a direct API to register snippets programmatically
      // The completion provider above handles the integration
      // In a future enhancement, we could write to VS Code's snippet files directly
    } catch (error) {
      console.error("Error refreshing VS Code snippets:", error);
    }
  }

  /**
   * Register a single snippet with VS Code
   */
  async registerSnippet(snippet: SnippetInterface): Promise<void> {
    // This would be called when a new snippet is created
    // For now, the completion provider handles all snippets dynamically
    console.log(
      `Snippet "${snippet.title}" registered for VS Code integration`
    );
  }

  /**
   * Unregister a snippet from VS Code
   */
  async unregisterSnippet(snippetId: string): Promise<void> {
    // This would be called when a snippet is deleted
    // For now, the completion provider handles all snippets dynamically
    console.log(`Snippet ${snippetId} unregistered from VS Code integration`);
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
   * Dispose of all resources
   */
  async dispose(): Promise<void> {
    console.log("Disposing VS Code snippet integration resources...");

    this.disposables.forEach((disposable) => {
      try {
        disposable.dispose();
      } catch (error) {
        console.error("Error disposing VS Code integration resource:", error);
      }
    });

    this.disposables = [];
    console.log("VS Code snippet integration disposed");
  }
}
