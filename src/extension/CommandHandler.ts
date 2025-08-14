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

      // Create snippet data
      const snippetData: SnippetData = {
        title: title.trim(),
        description: description?.trim() || "",
        code: selectedText,
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
   * Insert a snippet from the library
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

      // Create quick pick items
      const quickPickItems: (vscode.QuickPickItem & {
        snippet: SnippetInterface;
      })[] = snippets.map((snippet) => ({
        label: snippet.title,
        description: snippet.language,
        detail: snippet.description || "No description",
        snippet,
      }));

      // Show quick pick
      const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: "Select a snippet to insert",
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selected) {
        return; // User cancelled
      }

      // Insert the snippet
      await this.insertSnippetAtCursor(editor, selected.snippet);

      // Increment usage count
      await this.snippetManager.incrementUsage(selected.snippet.id);
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
   * Insert snippet at cursor position
   */
  private async insertSnippetAtCursor(
    editor: vscode.TextEditor,
    snippet: SnippetInterface
  ): Promise<void> {
    const position = editor.selection.active;
    const snippetString = new vscode.SnippetString(snippet.code);

    await editor.insertSnippet(snippetString, position);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // No specific resources to dispose for now
  }
}
