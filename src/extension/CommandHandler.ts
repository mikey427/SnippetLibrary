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
          label: "$(list-selection) Bulk Operations",
          description: "Manage multiple snippets at once",
          detail: "Select multiple snippets for bulk operations",
          snippet: {} as SnippetInterface,
          action: "bulk",
        },
        {
          label: "$(organization) Organize Snippets",
          description: "Organize snippets by categories and tags",
          detail: "Manage snippet organization and categorization",
          snippet: {} as SnippetInterface,
          action: "organize",
        },
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
        case "bulk":
          await this.bulkOperations();
          break;
        case "organize":
          await this.organizeSnippets();
          break;
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
   * Bulk operations for multiple snippets
   */
  async bulkOperations(): Promise<void> {
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
        vscode.window.showInformationMessage("No snippets found!");
        return;
      }

      // Create multi-select quick pick items
      const quickPickItems: (vscode.QuickPickItem & {
        snippet: SnippetInterface;
      })[] = snippets.map((snippet) => ({
        label: `$(file-code) ${snippet.title}`,
        description: `${snippet.language} | ${
          snippet.tags.join(", ") || "No tags"
        }`,
        detail: snippet.description || "No description",
        snippet,
      }));

      const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder:
          "Select snippets for bulk operations (use Ctrl/Cmd to multi-select)",
        canPickMany: true,
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selectedItems || selectedItems.length === 0) {
        return; // User cancelled or no selection
      }

      const selectedSnippets = selectedItems.map((item) => item.snippet);

      // Show bulk operation options
      const operation = await vscode.window.showQuickPick(
        [
          {
            label: "$(trash) Delete Selected",
            value: "delete",
            description: `Delete ${selectedSnippets.length} snippets`,
          },
          {
            label: "$(tag) Add Tags",
            value: "addTags",
            description: `Add tags to ${selectedSnippets.length} snippets`,
          },
          {
            label: "$(close) Remove Tags",
            value: "removeTags",
            description: `Remove tags from ${selectedSnippets.length} snippets`,
          },
          {
            label: "$(organization) Set Category",
            value: "setCategory",
            description: `Set category for ${selectedSnippets.length} snippets`,
          },
          {
            label: "$(export) Export Selected",
            value: "export",
            description: `Export ${selectedSnippets.length} snippets`,
          },
        ],
        {
          placeHolder: "Choose bulk operation",
        }
      );

      if (!operation) {
        return; // User cancelled
      }

      switch (operation.value) {
        case "delete":
          await this.bulkDelete(selectedSnippets);
          break;
        case "addTags":
          await this.bulkAddTags(selectedSnippets);
          break;
        case "removeTags":
          await this.bulkRemoveTags(selectedSnippets);
          break;
        case "setCategory":
          await this.bulkSetCategory(selectedSnippets);
          break;
        case "export":
          await this.bulkExport(selectedSnippets);
          break;
      }
    } catch (error) {
      console.error("Error in bulk operations:", error);
      vscode.window.showErrorMessage(
        `Error in bulk operations: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Organize snippets by categories and tags
   */
  async organizeSnippets(): Promise<void> {
    try {
      const operation = await vscode.window.showQuickPick(
        [
          {
            label: "$(list-tree) View by Category",
            value: "viewByCategory",
            description: "Browse snippets organized by category",
          },
          {
            label: "$(tag) View by Tags",
            value: "viewByTags",
            description: "Browse snippets organized by tags",
          },
          {
            label: "$(symbol-misc) View by Language",
            value: "viewByLanguage",
            description: "Browse snippets organized by programming language",
          },
          {
            label: "$(graph) Usage Statistics",
            value: "statistics",
            description: "View snippet usage statistics and insights",
          },
          {
            label: "$(organization) Cleanup",
            value: "cleanup",
            description: "Clean up unused tags and empty categories",
          },
        ],
        {
          placeHolder: "Choose organization view or action",
        }
      );

      if (!operation) {
        return; // User cancelled
      }

      switch (operation.value) {
        case "viewByCategory":
          await this.viewSnippetsByCategory();
          break;
        case "viewByTags":
          await this.viewSnippetsByTags();
          break;
        case "viewByLanguage":
          await this.viewSnippetsByLanguage();
          break;
        case "statistics":
          await this.showUsageStatistics();
          break;
        case "cleanup":
          await this.cleanupOrganization();
          break;
      }
    } catch (error) {
      console.error("Error organizing snippets:", error);
      vscode.window.showErrorMessage(
        `Error organizing snippets: ${
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
   * Edit a snippet with full metadata modification
   */
  private async editSnippet(snippet: SnippetInterface): Promise<void> {
    try {
      // Create a multi-step input for editing
      const editOptions = await vscode.window.showQuickPick(
        [
          {
            label: "$(edit) Edit All Properties",
            value: "all",
            description: "Edit title, description, code, tags, and category",
          },
          {
            label: "$(symbol-text) Edit Title & Description",
            value: "metadata",
            description: "Edit only title and description",
          },
          {
            label: "$(code) Edit Code",
            value: "code",
            description: "Edit the snippet code",
          },
          {
            label: "$(tag) Edit Tags & Category",
            value: "tags",
            description: "Edit tags and category",
          },
        ],
        {
          placeHolder: "What would you like to edit?",
        }
      );

      if (!editOptions) {
        return; // User cancelled
      }

      const updates: Partial<SnippetData> = {};

      switch (editOptions.value) {
        case "all":
          await this.editAllProperties(snippet, updates);
          break;
        case "metadata":
          await this.editMetadata(snippet, updates);
          break;
        case "code":
          await this.editCode(snippet, updates);
          break;
        case "tags":
          await this.editTagsAndCategory(snippet, updates);
          break;
      }

      // Apply updates if any were made
      if (Object.keys(updates).length > 0) {
        const result = await this.snippetManager.updateSnippet(
          snippet.id,
          updates
        );
        if (result.success) {
          vscode.window.showInformationMessage(
            `Snippet "${snippet.title}" updated successfully!`
          );
        } else {
          vscode.window.showErrorMessage(
            `Failed to update snippet: ${result.error.message}`
          );
        }
      }
    } catch (error) {
      console.error("Error editing snippet:", error);
      vscode.window.showErrorMessage(
        `Error editing snippet: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Edit all properties of a snippet
   */
  private async editAllProperties(
    snippet: SnippetInterface,
    updates: Partial<SnippetData>
  ): Promise<void> {
    // Edit title
    const title = await vscode.window.showInputBox({
      prompt: "Enter snippet title",
      value: snippet.title,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Title is required";
        }
        return null;
      },
    });

    if (title === undefined) return; // User cancelled
    if (title !== snippet.title) updates.title = title.trim();

    // Edit description
    const description = await vscode.window.showInputBox({
      prompt: "Enter snippet description",
      value: snippet.description,
    });

    if (description === undefined) return; // User cancelled
    if (description !== snippet.description)
      updates.description = description.trim();

    // Edit code
    await this.editCodeInEditor(snippet, updates);

    // Edit tags
    const tagsInput = await vscode.window.showInputBox({
      prompt: "Enter tags (comma-separated)",
      value: snippet.tags.join(", "),
    });

    if (tagsInput === undefined) return; // User cancelled
    const newTags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (JSON.stringify(newTags) !== JSON.stringify(snippet.tags)) {
      updates.tags = newTags;
    }

    // Edit category
    const category = await vscode.window.showInputBox({
      prompt: "Enter category",
      value: snippet.category || "",
    });

    if (category === undefined) return; // User cancelled
    if (category !== (snippet.category || "")) {
      updates.category = category.trim() || undefined;
    }

    // Edit prefix
    const prefix = await vscode.window.showInputBox({
      prompt: "Enter snippet prefix for IntelliSense",
      value: snippet.prefix || "",
      validateInput: (value) => {
        if (value && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
          return "Prefix must start with a letter and contain only letters, numbers, and underscores";
        }
        return null;
      },
    });

    if (prefix === undefined) return; // User cancelled
    if (prefix !== (snippet.prefix || "")) {
      updates.prefix = prefix.trim() || undefined;
    }
  }

  /**
   * Edit metadata (title and description) only
   */
  private async editMetadata(
    snippet: SnippetInterface,
    updates: Partial<SnippetData>
  ): Promise<void> {
    const title = await vscode.window.showInputBox({
      prompt: "Enter snippet title",
      value: snippet.title,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Title is required";
        }
        return null;
      },
    });

    if (title === undefined) return; // User cancelled
    if (title !== snippet.title) updates.title = title.trim();

    const description = await vscode.window.showInputBox({
      prompt: "Enter snippet description",
      value: snippet.description,
    });

    if (description === undefined) return; // User cancelled
    if (description !== snippet.description)
      updates.description = description.trim();
  }

  /**
   * Edit code only
   */
  private async editCode(
    snippet: SnippetInterface,
    updates: Partial<SnippetData>
  ): Promise<void> {
    await this.editCodeInEditor(snippet, updates);
  }

  /**
   * Edit tags and category only
   */
  private async editTagsAndCategory(
    snippet: SnippetInterface,
    updates: Partial<SnippetData>
  ): Promise<void> {
    // Get existing tags for suggestions
    const allTagsResult = await this.snippetManager.getTags();
    const existingTags = allTagsResult.success ? allTagsResult.data : [];

    const tagsInput = await vscode.window.showInputBox({
      prompt: `Enter tags (comma-separated). Available: ${existingTags.join(
        ", "
      )}`,
      value: snippet.tags.join(", "),
    });

    if (tagsInput === undefined) return; // User cancelled
    const newTags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (JSON.stringify(newTags) !== JSON.stringify(snippet.tags)) {
      updates.tags = newTags;
    }

    // Get existing categories for suggestions
    const allCategoriesResult = await this.snippetManager.getCategories();
    const existingCategories = allCategoriesResult.success
      ? allCategoriesResult.data
      : [];

    const categoryInput =
      existingCategories.length > 0
        ? await vscode.window.showQuickPick(
            [
              { label: "$(add) Create New Category", value: "__new__" },
              ...existingCategories.map((cat) => ({ label: cat, value: cat })),
              { label: "$(close) No Category", value: "" },
            ],
            {
              placeHolder: "Select or create a category",
            }
          )
        : null;

    let category: string | undefined;
    if (categoryInput?.value === "__new__") {
      const newCategory = await vscode.window.showInputBox({
        prompt: "Enter new category name",
      });
      category = newCategory?.trim();
    } else if (categoryInput) {
      category = categoryInput.value || undefined;
    } else {
      // Fallback to input box if no existing categories
      const categoryText = await vscode.window.showInputBox({
        prompt: "Enter category",
        value: snippet.category || "",
      });
      category = categoryText?.trim() || undefined;
    }

    if (category !== (snippet.category || "")) {
      updates.category = category;
    }
  }

  /**
   * Edit code in a temporary editor
   */
  private async editCodeInEditor(
    snippet: SnippetInterface,
    updates: Partial<SnippetData>
  ): Promise<void> {
    // Create a temporary document with the snippet code
    const document = await vscode.workspace.openTextDocument({
      content: snippet.code,
      language: snippet.language,
    });

    const editor = await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
    });

    const choice = await vscode.window.showInformationMessage(
      `Edit the code for "${snippet.title}", then click "Save Changes"`,
      { modal: false },
      "Save Changes",
      "Cancel"
    );

    if (choice === "Save Changes") {
      const newCode = editor.document.getText();
      if (newCode !== snippet.code) {
        updates.code = newCode;
      }
    }

    // Close the temporary editor
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
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
   * Delete a snippet with confirmation
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
   * Bulk delete multiple snippets
   */
  private async bulkDelete(snippets: SnippetInterface[]): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      `Are you sure you want to delete ${snippets.length} snippets?`,
      { modal: true },
      "Delete All"
    );

    if (confirmation !== "Delete All") {
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Deleting snippets...",
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < snippets.length; i++) {
          const snippet = snippets[i];
          progress.report({
            increment: 100 / snippets.length,
            message: `Deleting "${snippet.title}"...`,
          });

          const result = await this.snippetManager.deleteSnippet(snippet.id);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${snippet.title}: ${result.error.message}`);
          }
        }
      }
    );

    if (errorCount === 0) {
      vscode.window.showInformationMessage(
        `Successfully deleted ${successCount} snippets!`
      );
    } else {
      vscode.window.showWarningMessage(
        `Deleted ${successCount} snippets, ${errorCount} failed. Check output for details.`
      );
      console.error("Bulk delete errors:", errors);
    }
  }

  /**
   * Bulk add tags to multiple snippets
   */
  private async bulkAddTags(snippets: SnippetInterface[]): Promise<void> {
    // Get existing tags for suggestions
    const allTagsResult = await this.snippetManager.getTags();
    const existingTags = allTagsResult.success ? allTagsResult.data : [];

    const tagsInput = await vscode.window.showInputBox({
      prompt: `Enter tags to add (comma-separated). Available: ${existingTags.join(
        ", "
      )}`,
      placeHolder: "tag1, tag2, tag3",
    });

    if (!tagsInput) {
      return; // User cancelled
    }

    const tagsToAdd = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (tagsToAdd.length === 0) {
      vscode.window.showWarningMessage("No valid tags provided");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Adding tags...",
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < snippets.length; i++) {
          const snippet = snippets[i];
          progress.report({
            increment: 100 / snippets.length,
            message: `Adding tags to "${snippet.title}"...`,
          });

          const newTags = [...new Set([...snippet.tags, ...tagsToAdd])];
          const result = await this.snippetManager.updateSnippet(snippet.id, {
            tags: newTags,
          });

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        }
      }
    );

    vscode.window.showInformationMessage(
      `Added tags to ${successCount} snippets${
        errorCount > 0 ? `, ${errorCount} failed` : ""
      }`
    );
  }

  /**
   * Bulk remove tags from multiple snippets
   */
  private async bulkRemoveTags(snippets: SnippetInterface[]): Promise<void> {
    // Get all tags from selected snippets
    const allTags = new Set<string>();
    snippets.forEach((snippet) => {
      snippet.tags.forEach((tag) => allTags.add(tag));
    });

    if (allTags.size === 0) {
      vscode.window.showInformationMessage(
        "Selected snippets have no tags to remove"
      );
      return;
    }

    const tagsToRemove = await vscode.window.showQuickPick(
      Array.from(allTags).map((tag) => ({ label: tag, value: tag })),
      {
        placeHolder: "Select tags to remove",
        canPickMany: true,
      }
    );

    if (!tagsToRemove || tagsToRemove.length === 0) {
      return; // User cancelled
    }

    const tagsToRemoveSet = new Set(tagsToRemove.map((t) => t.value));
    let successCount = 0;
    let errorCount = 0;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Removing tags...",
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < snippets.length; i++) {
          const snippet = snippets[i];
          progress.report({
            increment: 100 / snippets.length,
            message: `Removing tags from "${snippet.title}"...`,
          });

          const newTags = snippet.tags.filter(
            (tag) => !tagsToRemoveSet.has(tag)
          );
          if (newTags.length !== snippet.tags.length) {
            const result = await this.snippetManager.updateSnippet(snippet.id, {
              tags: newTags,
            });

            if (result.success) {
              successCount++;
            } else {
              errorCount++;
            }
          }
        }
      }
    );

    vscode.window.showInformationMessage(
      `Removed tags from ${successCount} snippets${
        errorCount > 0 ? `, ${errorCount} failed` : ""
      }`
    );
  }

  /**
   * Bulk set category for multiple snippets
   */
  private async bulkSetCategory(snippets: SnippetInterface[]): Promise<void> {
    // Get existing categories for suggestions
    const allCategoriesResult = await this.snippetManager.getCategories();
    const existingCategories = allCategoriesResult.success
      ? allCategoriesResult.data
      : [];

    const categoryOptions = [
      { label: "$(add) Create New Category", value: "__new__" },
      ...existingCategories.map((cat) => ({ label: cat, value: cat })),
      { label: "$(close) Remove Category", value: "" },
    ];

    const selectedCategory = await vscode.window.showQuickPick(
      categoryOptions,
      {
        placeHolder: "Select or create a category",
      }
    );

    if (!selectedCategory) {
      return; // User cancelled
    }

    let category: string | undefined;
    if (selectedCategory.value === "__new__") {
      const newCategory = await vscode.window.showInputBox({
        prompt: "Enter new category name",
      });
      category = newCategory?.trim();
      if (!category) return;
    } else {
      category = selectedCategory.value || undefined;
    }

    let successCount = 0;
    let errorCount = 0;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Setting category...",
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < snippets.length; i++) {
          const snippet = snippets[i];
          progress.report({
            increment: 100 / snippets.length,
            message: `Setting category for "${snippet.title}"...`,
          });

          const result = await this.snippetManager.updateSnippet(snippet.id, {
            category,
          });

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        }
      }
    );

    const categoryName = category || "no category";
    vscode.window.showInformationMessage(
      `Set category "${categoryName}" for ${successCount} snippets${
        errorCount > 0 ? `, ${errorCount} failed` : ""
      }`
    );
  }

  /**
   * Bulk export selected snippets
   */
  private async bulkExport(snippets: SnippetInterface[]): Promise<void> {
    try {
      const exportData = {
        snippets,
        metadata: {
          exportedAt: new Date(),
          version: "1.0.0",
          count: snippets.length,
        },
      };

      const exportJson = JSON.stringify(exportData, null, 2);

      // Show save dialog
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(
          `selected-snippets-${new Date().toISOString().split("T")[0]}.json`
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
          `Exported ${snippets.length} selected snippets to ${uri.fsPath}`
        );
      }
    } catch (error) {
      console.error("Error exporting selected snippets:", error);
      vscode.window.showErrorMessage(
        `Error exporting snippets: ${
          error instanceof Error ? error.message : error
        }`
      );
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
   * View snippets organized by category
   */
  private async viewSnippetsByCategory(): Promise<void> {
    try {
      const categoriesResult = await this.snippetManager.getCategories();
      if (!categoriesResult.success) {
        vscode.window.showErrorMessage(
          `Failed to get categories: ${categoriesResult.error.message}`
        );
        return;
      }

      const categories = categoriesResult.data;
      const allSnippetsResult = await this.snippetManager.getAllSnippets();
      if (!allSnippetsResult.success) {
        vscode.window.showErrorMessage(
          `Failed to get snippets: ${allSnippetsResult.error.message}`
        );
        return;
      }

      const allSnippets = allSnippetsResult.data;
      const uncategorizedSnippets = allSnippets.filter((s) => !s.category);

      // Create category options
      const categoryOptions = [
        ...categories.map((category) => {
          const count = allSnippets.filter(
            (s) => s.category === category
          ).length;
          return {
            label: `$(folder) ${category}`,
            description: `${count} snippets`,
            value: category,
          };
        }),
      ];

      if (uncategorizedSnippets.length > 0) {
        categoryOptions.push({
          label: "$(file) Uncategorized",
          description: `${uncategorizedSnippets.length} snippets`,
          value: "__uncategorized__",
        });
      }

      const selectedCategory = await vscode.window.showQuickPick(
        categoryOptions,
        {
          placeHolder: "Select a category to view",
        }
      );

      if (!selectedCategory) {
        return; // User cancelled
      }

      let snippetsToShow: SnippetInterface[];
      if (selectedCategory.value === "__uncategorized__") {
        snippetsToShow = uncategorizedSnippets;
      } else {
        snippetsToShow = allSnippets.filter(
          (s) => s.category === selectedCategory.value
        );
      }

      await this.showSnippetList(
        snippetsToShow,
        `Snippets in "${selectedCategory.label}"`
      );
    } catch (error) {
      console.error("Error viewing snippets by category:", error);
      vscode.window.showErrorMessage(
        `Error viewing snippets by category: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * View snippets organized by tags
   */
  private async viewSnippetsByTags(): Promise<void> {
    try {
      const tagsResult = await this.snippetManager.getTags();
      if (!tagsResult.success) {
        vscode.window.showErrorMessage(
          `Failed to get tags: ${tagsResult.error.message}`
        );
        return;
      }

      const tags = tagsResult.data;
      const allSnippetsResult = await this.snippetManager.getAllSnippets();
      if (!allSnippetsResult.success) {
        vscode.window.showErrorMessage(
          `Failed to get snippets: ${allSnippetsResult.error.message}`
        );
        return;
      }

      const allSnippets = allSnippetsResult.data;

      // Create tag options with counts
      const tagOptions = tags.map((tag) => {
        const count = allSnippets.filter((s) => s.tags.includes(tag)).length;
        return {
          label: `$(tag) ${tag}`,
          description: `${count} snippets`,
          value: tag,
        };
      });

      const selectedTag = await vscode.window.showQuickPick(tagOptions, {
        placeHolder: "Select a tag to view",
      });

      if (!selectedTag) {
        return; // User cancelled
      }

      const snippetsWithTag = allSnippets.filter((s) =>
        s.tags.includes(selectedTag.value)
      );

      await this.showSnippetList(
        snippetsWithTag,
        `Snippets tagged with "${selectedTag.value}"`
      );
    } catch (error) {
      console.error("Error viewing snippets by tags:", error);
      vscode.window.showErrorMessage(
        `Error viewing snippets by tags: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * View snippets organized by language
   */
  private async viewSnippetsByLanguage(): Promise<void> {
    try {
      const languagesResult = await this.snippetManager.getLanguages();
      if (!languagesResult.success) {
        vscode.window.showErrorMessage(
          `Failed to get languages: ${languagesResult.error.message}`
        );
        return;
      }

      const languages = languagesResult.data;
      const allSnippetsResult = await this.snippetManager.getAllSnippets();
      if (!allSnippetsResult.success) {
        vscode.window.showErrorMessage(
          `Failed to get snippets: ${allSnippetsResult.error.message}`
        );
        return;
      }

      const allSnippets = allSnippetsResult.data;

      // Create language options with counts
      const languageOptions = languages.map((language) => {
        const count = allSnippets.filter((s) => s.language === language).length;
        return {
          label: `$(symbol-misc) ${language}`,
          description: `${count} snippets`,
          value: language,
        };
      });

      const selectedLanguage = await vscode.window.showQuickPick(
        languageOptions,
        {
          placeHolder: "Select a language to view",
        }
      );

      if (!selectedLanguage) {
        return; // User cancelled
      }

      const snippetsInLanguage = allSnippets.filter(
        (s) => s.language === selectedLanguage.value
      );

      await this.showSnippetList(
        snippetsInLanguage,
        `${selectedLanguage.value} snippets`
      );
    } catch (error) {
      console.error("Error viewing snippets by language:", error);
      vscode.window.showErrorMessage(
        `Error viewing snippets by language: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Show usage statistics
   */
  private async showUsageStatistics(): Promise<void> {
    try {
      const statsResult = await this.snippetManager.getUsageStatistics();
      if (!statsResult.success) {
        vscode.window.showErrorMessage(
          `Failed to get statistics: ${statsResult.error.message}`
        );
        return;
      }

      const stats = statsResult.data;

      // Create statistics content
      const content = [
        "# Snippet Library Statistics",
        "",
        `**Total Snippets:** ${stats.totalSnippets}`,
        `**Total Usage:** ${stats.totalUsage}`,
        `**Average Usage:** ${stats.averageUsage.toFixed(2)}`,
        "",
        "## Most Used Snippets",
        ...stats.mostUsedSnippets
          .slice(0, 5)
          .map(
            (item, index) =>
              `${index + 1}. **${item.snippet.title}** (${
                item.usageCount
              } uses)`
          ),
        "",
        "## Language Distribution",
        ...stats.languageDistribution
          .slice(0, 5)
          .map(
            (item) =>
              `- **${item.language}:** ${
                item.count
              } snippets (${item.percentage.toFixed(1)}%)`
          ),
        "",
        "## Top Tags",
        ...stats.tagDistribution
          .slice(0, 10)
          .map(
            (item) =>
              `- **${item.tag}:** ${
                item.count
              } snippets (${item.percentage.toFixed(1)}%)`
          ),
        "",
        "## Categories",
        ...stats.categoryDistribution.map(
          (item) =>
            `- **${item.category}:** ${
              item.count
            } snippets (${item.percentage.toFixed(1)}%)`
        ),
      ].join("\n");

      // Show statistics in a new document
      const document = await vscode.workspace.openTextDocument({
        content,
        language: "markdown",
      });

      await vscode.window.showTextDocument(document, { preview: true });
    } catch (error) {
      console.error("Error showing usage statistics:", error);
      vscode.window.showErrorMessage(
        `Error showing statistics: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Cleanup organization (remove unused tags, empty categories)
   */
  private async cleanupOrganization(): Promise<void> {
    try {
      const allSnippetsResult = await this.snippetManager.getAllSnippets();
      if (!allSnippetsResult.success) {
        vscode.window.showErrorMessage(
          `Failed to get snippets: ${allSnippetsResult.error.message}`
        );
        return;
      }

      const allSnippets = allSnippetsResult.data;

      // Find empty tags and categories (this is informational since tags/categories are derived from snippets)
      const usedTags = new Set<string>();
      const usedCategories = new Set<string>();

      allSnippets.forEach((snippet) => {
        snippet.tags.forEach((tag) => usedTags.add(tag));
        if (snippet.category) {
          usedCategories.add(snippet.category);
        }
      });

      // Show cleanup options
      const cleanupOptions = [
        {
          label: "$(tag) Clean Empty Tags",
          value: "tags",
          description: "Remove empty tags from snippets",
        },
        {
          label: "$(organization) Normalize Categories",
          value: "categories",
          description: "Standardize category names",
        },
        {
          label: "$(symbol-misc) Remove Duplicate Tags",
          value: "duplicates",
          description: "Remove duplicate tags from snippets",
        },
      ];

      const selectedCleanup = await vscode.window.showQuickPick(
        cleanupOptions,
        {
          placeHolder: "Select cleanup operation",
          canPickMany: true,
        }
      );

      if (!selectedCleanup || selectedCleanup.length === 0) {
        return; // User cancelled
      }

      let cleanedCount = 0;

      for (const cleanup of selectedCleanup) {
        switch (cleanup.value) {
          case "tags":
            cleanedCount += await this.cleanEmptyTags(allSnippets);
            break;
          case "categories":
            cleanedCount += await this.normalizeCategories(allSnippets);
            break;
          case "duplicates":
            cleanedCount += await this.removeDuplicateTags(allSnippets);
            break;
        }
      }

      vscode.window.showInformationMessage(
        `Cleanup completed! ${cleanedCount} snippets were updated.`
      );
    } catch (error) {
      console.error("Error cleaning up organization:", error);
      vscode.window.showErrorMessage(
        `Error cleaning up: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Show a list of snippets with management options
   */
  private async showSnippetList(
    snippets: SnippetInterface[],
    title: string
  ): Promise<void> {
    if (snippets.length === 0) {
      vscode.window.showInformationMessage(`No snippets found in ${title}`);
      return;
    }

    const quickPickItems = snippets.map((snippet) => ({
      label: `$(file-code) ${snippet.title}`,
      description: `${snippet.language} | ${
        snippet.tags.join(", ") || "No tags"
      }`,
      detail: snippet.description || "No description",
      snippet,
    }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: `${title} (${snippets.length} snippets)`,
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      await this.manageIndividualSnippet(selected.snippet);
    }
  }

  /**
   * Clean empty tags from snippets
   */
  private async cleanEmptyTags(snippets: SnippetInterface[]): Promise<number> {
    let cleanedCount = 0;

    for (const snippet of snippets) {
      const cleanTags = snippet.tags.filter((tag) => tag.trim().length > 0);
      if (cleanTags.length !== snippet.tags.length) {
        const result = await this.snippetManager.updateSnippet(snippet.id, {
          tags: cleanTags,
        });
        if (result.success) {
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Normalize category names
   */
  private async normalizeCategories(
    snippets: SnippetInterface[]
  ): Promise<number> {
    let cleanedCount = 0;

    for (const snippet of snippets) {
      if (snippet.category) {
        const normalizedCategory = snippet.category
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-");

        if (normalizedCategory !== snippet.category) {
          const result = await this.snippetManager.updateSnippet(snippet.id, {
            category: normalizedCategory,
          });
          if (result.success) {
            cleanedCount++;
          }
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Remove duplicate tags from snippets
   */
  private async removeDuplicateTags(
    snippets: SnippetInterface[]
  ): Promise<number> {
    let cleanedCount = 0;

    for (const snippet of snippets) {
      const uniqueTags = [...new Set(snippet.tags)];
      if (uniqueTags.length !== snippet.tags.length) {
        const result = await this.snippetManager.updateSnippet(snippet.id, {
          tags: uniqueTags,
        });
        if (result.success) {
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // No specific resources to dispose for now
  }
}
