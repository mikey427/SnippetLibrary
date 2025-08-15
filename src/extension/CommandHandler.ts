import * as vscode from "vscode";
import * as path from "path";
import { SnippetManagerImpl } from "../core/services/SnippetManagerImpl";
import { SnippetInterface, SnippetData, SearchQueryInterface } from "../types";
import { ConfigurationManager } from "./ConfigurationManager";

/**
 * Handles all VS Code command implementations
 */
export class CommandHandler {
  private snippetManager: SnippetManagerImpl;
  private configManager: ConfigurationManager;

  constructor(
    snippetManager: SnippetManagerImpl,
    configManager: ConfigurationManager
  ) {
    this.snippetManager = snippetManager;
    this.configManager = configManager;
  }

  /**
   * Update the snippet manager reference (used when configuration changes)
   */
  updateSnippetManager(snippetManager: SnippetManagerImpl): void {
    this.snippetManager = snippetManager;
  }

  /**
   * Save selected code as a snippet
   */
  async saveSnippet(): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(
          "No active editor found. Please open a file and select code to save as snippet."
        );
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage(
          "No code selected. Please select code to save as snippet."
        );
        return;
      }

      const selectedText = editor.document.getText(selection);
      const languageId = editor.document.languageId;

      // Prompt for snippet metadata
      const title = await vscode.window.showInputBox({
        prompt: "Enter snippet title",
        placeHolder: "My Snippet",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "Title is required";
          }
          return null;
        },
      });

      if (!title) {
        return; // User cancelled
      }

      const description = await vscode.window.showInputBox({
        prompt: "Enter snippet description (optional)",
        placeHolder: "Description of what this snippet does",
      });

      const tagsInput = await vscode.window.showInputBox({
        prompt: "Enter tags (comma-separated, optional)",
        placeHolder: "utility, helper, function",
      });

      const tags = tagsInput
        ? tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
        : [];

      const category = await vscode.window.showInputBox({
        prompt: "Enter category (optional)",
        placeHolder: "utilities",
      });

      const prefix = await vscode.window.showInputBox({
        prompt: "Enter snippet prefix for IntelliSense (optional)",
        placeHolder: "mysnip",
        validateInput: (value) => {
          if (value && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
            return "Prefix must start with a letter and contain only letters, numbers, and underscores";
          }
          return null;
        },
      });

      // Ask if user wants to add tab stops and placeholders
      const enhanceSnippet = await vscode.window.showQuickPick(
        [
          {
            label: "Auto-enhance with placeholders",
            description:
              "Automatically detect and add tab stops for common patterns",
            value: "auto",
          },
          {
            label: "Manual enhancement",
            description: "Let me add tab stops and placeholders manually",
            value: "manual",
          },
          {
            label: "Use as-is",
            description: "Save the code exactly as selected",
            value: "none",
          },
        ],
        {
          placeHolder: "How should the snippet be processed?",
          ignoreFocusOut: true,
        }
      );

      if (!enhanceSnippet) {
        return; // User cancelled
      }

      let processedCode = selectedText;
      if (enhanceSnippet.value === "auto") {
        processedCode = this.autoEnhanceSnippet(selectedText);
      } else if (enhanceSnippet.value === "manual") {
        const manualResult = await this.manualEnhanceSnippet(selectedText);
        if (manualResult === null) {
          return; // User cancelled
        }
        processedCode = manualResult;
      }

      // Create snippet data
      const snippetData: SnippetData = {
        title: title.trim(),
        description: description?.trim() || "",
        code: processedCode,
        language: languageId,
        tags,
        category: category?.trim() || undefined,
        prefix: prefix?.trim() || undefined,
      };

      // Save the snippet
      const result = await this.snippetManager.createSnippet(snippetData);
      if (result.success) {
        vscode.window.showInformationMessage(
          `Snippet "${title}" saved successfully!`
        );
      } else {
        vscode.window.showErrorMessage(
          `Failed to save snippet: ${result.error.message}`
        );
      }
    } catch (error) {
      console.error("Error saving snippet:", error);
      vscode.window.showErrorMessage(
        `Error saving snippet: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Insert a snippet from the library with enhanced preview
   */
  async insertSnippet(): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(
          "No active editor found. Please open a file to insert snippet."
        );
        return;
      }

      // Get all snippets
      const result = await this.snippetManager.getAllSnippets();
      if (!result.success) {
        vscode.window.showErrorMessage(
          `Failed to load snippets: ${result.error.message}`
        );
        return;
      }

      const snippets = result.data;
      if (snippets.length === 0) {
        vscode.window.showInformationMessage(
          "No snippets found. Create some snippets first!"
        );
        return;
      }

      // Filter snippets by current language if available
      const currentLanguage = editor.document.languageId;
      const relevantSnippets = this.filterSnippetsByRelevance(
        snippets,
        currentLanguage
      );

      // Create enhanced quick pick items with preview
      const quickPickItems: (vscode.QuickPickItem & {
        snippet: SnippetInterface;
      })[] = relevantSnippets.map((snippet) => {
        const codePreview = this.createCodePreview(snippet.code);
        const tags =
          snippet.tags.length > 0 ? ` • ${snippet.tags.join(", ")}` : "";
        const usageInfo =
          snippet.usageCount > 0 ? ` • Used ${snippet.usageCount} times` : "";

        return {
          label: `$(file-code) ${snippet.title}`,
          description: `${snippet.language}${tags}${usageInfo}`,
          detail: `${
            snippet.description || "No description"
          }\n\n${codePreview}`,
          snippet,
        };
      });

      // Show enhanced quick pick with preview
      const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder:
          "Select a snippet to insert (filtered by current language)",
        matchOnDescription: true,
        matchOnDetail: true,
        ignoreFocusOut: false,
      });

      if (!selected) {
        return; // User cancelled
      }

      // Show preview before insertion
      const shouldInsert = await this.showSnippetPreview(
        selected.snippet,
        editor
      );
      if (!shouldInsert) {
        return; // User cancelled after preview
      }

      // Insert the snippet
      await this.insertSnippetAtCursor(editor, selected.snippet);

      // Increment usage count
      await this.snippetManager.incrementUsage(selected.snippet.id);

      // Show success message with undo hint
      vscode.window.showInformationMessage(
        `Inserted "${selected.snippet.title}" • Press Ctrl+Z to undo`
      );
    } catch (error) {
      console.error("Error inserting snippet:", error);
      vscode.window.showErrorMessage(
        `Error inserting snippet: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Filter snippets by relevance to current context
   */
  private filterSnippetsByRelevance(
    snippets: SnippetInterface[],
    currentLanguage: string
  ): SnippetInterface[] {
    // Sort snippets by relevance
    return snippets.sort((a, b) => {
      // Exact language match gets highest priority
      if (a.language === currentLanguage && b.language !== currentLanguage)
        return -1;
      if (b.language === currentLanguage && a.language !== currentLanguage)
        return 1;

      // Then by usage count
      if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;

      // Then by creation date (newer first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  /**
   * Create a code preview for quick pick display
   */
  private createCodePreview(code: string): string {
    const lines = code.split("\n");
    const maxLines = 3;
    const maxLength = 80;

    let preview = lines
      .slice(0, maxLines)
      .map((line) => {
        if (line.length > maxLength) {
          return line.substring(0, maxLength - 3) + "...";
        }
        return line;
      })
      .join("\n");

    if (lines.length > maxLines) {
      preview += "\n...";
    }

    return preview;
  }

  /**
   * Show snippet preview before insertion
   */
  private async showSnippetPreview(
    snippet: SnippetInterface,
    editor: vscode.TextEditor
  ): Promise<boolean> {
    const position = editor.selection.active;
    const processedCode = this.processSnippetCode(
      snippet.code,
      editor,
      position
    );

    // Create preview content
    const previewContent = [
      `// Snippet: ${snippet.title}`,
      `// Language: ${snippet.language}`,
      `// Description: ${snippet.description || "No description"}`,
      snippet.tags && snippet.tags.length > 0
        ? `// Tags: ${snippet.tags.join(", ")}`
        : "",
      "",
      "// Preview (with tab stops and placeholders):",
      processedCode,
      "",
      "// Original code:",
      snippet.code,
    ]
      .filter((line) => line !== "")
      .join("\n");

    // Show preview in a new document
    const previewDoc = await vscode.workspace.openTextDocument({
      content: previewContent,
      language: snippet.language,
    });

    await vscode.window.showTextDocument(previewDoc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: true,
      preserveFocus: true,
    });

    // Ask user to confirm insertion
    const choice = await vscode.window.showInformationMessage(
      `Insert "${snippet.title}" snippet?`,
      { modal: false },
      "Insert",
      "Cancel"
    );

    // Close preview document
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

    return choice === "Insert";
  }

  /**
   * Open snippet management interface
   */
  async manageSnippets(): Promise<void> {
    try {
      // Get all snippets
      const result = await this.snippetManager.getAllSnippets();
      if (!result.success) {
        vscode.window.showErrorMessage(
          `Failed to load snippets: ${result.error.message}`
        );
        return;
      }

      const snippets = result.data;
      if (snippets.length === 0) {
        vscode.window.showInformationMessage(
          "No snippets found. Create some snippets first!"
        );
        return;
      }

      // Create management quick pick items
      const quickPickItems: (vscode.QuickPickItem & {
        snippet: SnippetInterface;
        action: string;
      })[] = snippets.map((snippet) => ({
        label: `$(file-code) ${snippet.title}`,
        description: `${snippet.language} | ${
          snippet.tags.join(", ") || "No tags"
        }`,
        detail: snippet.description || "No description",
        snippet,
        action: "select",
      }));

      // Add management actions at the top
      quickPickItems.unshift(
        {
          label: "$(refresh) Refresh Snippets",
          description: "Reload snippets from storage",
          detail: "Refresh the snippet library",
          snippet: {} as SnippetInterface,
          action: "refresh",
        },
        {
          label: "$(export) Export Snippets",
          description: "Export snippets to file",
          detail: "Create a backup of your snippets",
          snippet: {} as SnippetInterface,
          action: "export",
        },
        {
          label: "$(import) Import Snippets",
          description: "Import snippets from file",
          detail: "Add snippets from a backup file",
          snippet: {} as SnippetInterface,
          action: "import",
        }
      );

      const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: "Select a snippet to manage or choose an action",
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selected) {
        return; // User cancelled
      }

      // Handle actions
      switch (selected.action) {
        case "refresh":
          await this.refreshSnippets();
          break;
        case "export":
          await this.exportSnippets();
          break;
        case "import":
          await this.importSnippets();
          break;
        case "select":
          await this.manageIndividualSnippet(selected.snippet);
          break;
      }
    } catch (error) {
      console.error("Error managing snippets:", error);
      vscode.window.showErrorMessage(
        `Error managing snippets: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Open web GUI (placeholder for now)
   */
  async openWebGUI(): Promise<void> {
    vscode.window.showInformationMessage(
      "Web GUI functionality will be implemented in a later task."
    );
  }

  /**
   * Refresh snippets from storage
   */
  async refreshSnippets(): Promise<void> {
    try {
      const result = await this.snippetManager.refresh();
      if (result.success) {
        vscode.window.showInformationMessage(
          "Snippets refreshed successfully!"
        );
      } else {
        vscode.window.showErrorMessage(
          `Failed to refresh snippets: ${result.error.message}`
        );
      }
    } catch (error) {
      console.error("Error refreshing snippets:", error);
      vscode.window.showErrorMessage(
        `Error refreshing snippets: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Export snippets to file
   */
  async exportSnippets(): Promise<void> {
    try {
      const result = await this.snippetManager.exportSnippets();
      if (!result.success) {
        vscode.window.showErrorMessage(
          `Failed to export snippets: ${result.error.message}`
        );
        return;
      }

      const exportData = result.data;
      const exportJson = JSON.stringify(exportData, null, 2);

      // Show save dialog
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(
          `snippets-export-${new Date().toISOString().split("T")[0]}.json`
        ),
        filters: {
          "JSON Files": ["json"],
        },
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(exportJson, "utf8")
        );
        vscode.window.showInformationMessage(
          `Exported ${exportData.snippets.length} snippets to ${uri.fsPath}`
        );
      }
    } catch (error) {
      console.error("Error exporting snippets:", error);
      vscode.window.showErrorMessage(
        `Error exporting snippets: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Import snippets from file
   */
  async importSnippets(): Promise<void> {
    try {
      // Show open dialog
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectMany: false,
        filters: {
          "JSON Files": ["json"],
        },
      });

      if (!uris || uris.length === 0) {
        return; // User cancelled
      }

      const fileContent = await vscode.workspace.fs.readFile(uris[0]);
      const importData = JSON.parse(fileContent.toString());

      // Ask for conflict resolution strategy
      const conflictResolution = await vscode.window.showQuickPick(
        [
          {
            label: "Skip",
            value: "skip",
            description: "Skip snippets that already exist",
          },
          {
            label: "Overwrite",
            value: "overwrite",
            description: "Replace existing snippets",
          },
          {
            label: "Rename",
            value: "rename",
            description: "Create new snippets with modified names",
          },
        ],
        {
          placeHolder: "How should conflicts be handled?",
        }
      );

      if (!conflictResolution) {
        return; // User cancelled
      }

      const result = await this.snippetManager.importSnippets({
        snippets: importData.snippets || [],
        conflictResolution: conflictResolution.value as
          | "skip"
          | "overwrite"
          | "rename",
      });

      if (result.success) {
        const importResult = result.data;
        vscode.window.showInformationMessage(
          `Import completed: ${importResult.imported} imported, ${importResult.skipped} skipped, ${importResult.errors.length} errors`
        );

        if (importResult.errors.length > 0) {
          console.error("Import errors:", importResult.errors);
        }
      } else {
        vscode.window.showErrorMessage(
          `Failed to import snippets: ${result.error.message}`
        );
      }
    } catch (error) {
      console.error("Error importing snippets:", error);
      vscode.window.showErrorMessage(
        `Error importing snippets: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Manage an individual snippet
   */
  private async manageIndividualSnippet(
    snippet: SnippetInterface
  ): Promise<void> {
    const action = await vscode.window.showQuickPick(
      [
        {
          label: "$(edit) Edit",
          value: "edit",
          description: "Edit snippet details",
        },
        {
          label: "$(eye) Preview",
          value: "preview",
          description: "View snippet code",
        },
        {
          label: "$(trash) Delete",
          value: "delete",
          description: "Delete this snippet",
        },
      ],
      {
        placeHolder: `What would you like to do with "${snippet.title}"?`,
      }
    );

    if (!action) {
      return; // User cancelled
    }

    switch (action.value) {
      case "edit":
        await this.editSnippet(snippet);
        break;
      case "preview":
        await this.previewSnippet(snippet);
        break;
      case "delete":
        await this.deleteSnippet(snippet);
        break;
    }
  }

  /**
   * Edit a snippet
   */
  private async editSnippet(snippet: SnippetInterface): Promise<void> {
    // For now, just show a message - full editing will be implemented in later tasks
    vscode.window.showInformationMessage(
      `Editing snippet "${snippet.title}" - Full editing functionality will be implemented in later tasks.`
    );
  }

  /**
   * Preview a snippet
   */
  private async previewSnippet(snippet: SnippetInterface): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      content: snippet.code,
      language: snippet.language,
    });
    await vscode.window.showTextDocument(document, { preview: true });
  }

  /**
   * Delete a snippet
   */
  private async deleteSnippet(snippet: SnippetInterface): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      `Are you sure you want to delete "${snippet.title}"?`,
      { modal: true },
      "Delete"
    );

    if (confirmation === "Delete") {
      const result = await this.snippetManager.deleteSnippet(snippet.id);
      if (result.success) {
        vscode.window.showInformationMessage(
          `Snippet "${snippet.title}" deleted successfully!`
        );
      } else {
        vscode.window.showErrorMessage(
          `Failed to delete snippet: ${result.error.message}`
        );
      }
    }
  }

  /**
   * Insert snippet at cursor position with enhanced formatting
   */
  private async insertSnippetAtCursor(
    editor: vscode.TextEditor,
    snippet: SnippetInterface
  ): Promise<void> {
    const position = editor.selection.active;

    // Convert snippet code to VS Code snippet format with tab stops and placeholders
    const processedCode = this.processSnippetCode(
      snippet.code,
      editor,
      position
    );
    const snippetString = new vscode.SnippetString(processedCode);

    await editor.insertSnippet(snippetString, position);
  }

  /**
   * Process snippet code to handle indentation, tab stops, and placeholders
   */
  private processSnippetCode(
    code: string,
    editor: vscode.TextEditor,
    position: vscode.Position
  ): string {
    // Get current line indentation
    const currentLine = editor.document.lineAt(position.line);
    const currentIndentation = this.getIndentation(currentLine.text);

    // Split code into lines
    const lines = code.split("\n");

    // Process each line
    const processedLines = lines.map((line, index) => {
      if (index === 0) {
        // First line: don't add extra indentation (cursor position handles it)
        return this.processSnippetSyntax(line);
      } else {
        // Subsequent lines: maintain relative indentation and add current indentation
        const lineIndentation = this.getIndentation(line);
        const trimmedLine = line.trim();

        if (trimmedLine === "") {
          return ""; // Empty lines stay empty
        }

        // Add current indentation plus the line's relative indentation
        return (
          currentIndentation +
          lineIndentation +
          this.processSnippetSyntax(trimmedLine)
        );
      }
    });

    return processedLines.join("\n");
  }

  /**
   * Process snippet syntax to add tab stops and placeholders
   */
  private processSnippetSyntax(code: string): string {
    // Convert common patterns to VS Code snippet syntax
    let processed = code;

    // Convert ${VARIABLE} to ${1:VARIABLE} for tab stops
    processed = processed.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, "${1:$1}");

    // Convert {{placeholder}} to ${1:placeholder}
    processed = processed.replace(/\{\{([^}]+)\}\}/g, "${1:$1}");

    // Convert [placeholder] to ${1:placeholder}
    processed = processed.replace(/\[([^\]]+)\]/g, "${1:$1}");

    // Add a final tab stop at the end if none exist
    if (!/\$\{\d+/.test(processed) && !/\$0/.test(processed)) {
      processed += "$0";
    }

    return processed;
  }

  /**
   * Get indentation from a line of text
   */
  private getIndentation(text: string): string {
    const match = text.match(/^(\s*)/);
    return match ? match[1] : "";
  }

  /**
   * Auto-enhance snippet with common placeholder patterns
   */
  private autoEnhanceSnippet(code: string): string {
    let enhanced = code;

    // Common patterns to enhance
    const patterns = [
      // Function names
      { regex: /function\s+(\w+)/g, replacement: "function ${1:$1}" },
      // Variable names in declarations
      { regex: /(?:let|const|var)\s+(\w+)/g, replacement: "$& = ${2:value}" },
      // Class names
      { regex: /class\s+(\w+)/g, replacement: "class ${1:$1}" },
      // String literals that look like placeholders
      { regex: /"([A-Z_][A-Z0-9_]*)"/g, replacement: '"${1:$1}"' },
      { regex: /'([A-Z_][A-Z0-9_]*)'/g, replacement: "'${1:$1}'" },
      // Method parameters
      {
        regex: /\(([^)]+)\)/g,
        replacement: (match: string, params: string) => {
          const paramList = params
            .split(",")
            .map((p: string, i: number) => {
              const trimmed = p.trim();
              return `\${${i + 1}:${trimmed}}`;
            })
            .join(", ");
          return `(${paramList})`;
        },
      },
    ];

    patterns.forEach((pattern) => {
      if (typeof pattern.replacement === "string") {
        enhanced = enhanced.replace(pattern.regex, pattern.replacement);
      } else {
        enhanced = enhanced.replace(pattern.regex, pattern.replacement);
      }
    });

    // Add final tab stop if none exist
    if (!/\$\{\d+/.test(enhanced)) {
      enhanced += "$0";
    }

    return enhanced;
  }

  /**
   * Manual enhancement of snippet with user input
   */
  private async manualEnhanceSnippet(code: string): Promise<string | null> {
    // Show the code in an editor for manual enhancement
    const doc = await vscode.workspace.openTextDocument({
      content:
        code +
        "\n\n// Add tab stops using ${1:placeholder} syntax\n// Use $0 for final cursor position",
      language: "plaintext",
    });

    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
    });

    const choice = await vscode.window.showInformationMessage(
      'Edit the snippet to add tab stops and placeholders, then click "Done"',
      { modal: false },
      "Done",
      "Cancel"
    );

    if (choice !== "Done") {
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      return null;
    }

    // Get the edited content
    const editedContent = editor.document.getText();
    const lines = editedContent.split("\n");

    // Remove the instruction lines
    const codeLines = [];
    for (const line of lines) {
      if (line.startsWith("// Add tab stops") || line.startsWith("// Use $0")) {
        break;
      }
      codeLines.push(line);
    }

    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

    return codeLines.join("\n").trim();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // No specific resources to dispose for now
  }
}
