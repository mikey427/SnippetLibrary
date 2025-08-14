import * as vscode from "vscode";
import { SnippetManagerImpl } from "../core/services/SnippetManagerImpl";
import {
  createStorageService,
  createWorkspaceStorageService,
  createGlobalStorageService,
} from "../core/services";
import { SnippetInterface, StorageConfigInterface } from "../types";
import { CommandHandler } from "./CommandHandler";
import { VSCodeSnippetIntegration } from "./VSCodeSnippetIntegration";
import { ConfigurationManager } from "./ConfigurationManager";

/**
 * Main extension class that coordinates all VS Code integration
 */
export class SnippetLibraryExtension {
  private context: vscode.ExtensionContext;
  private snippetManager: SnippetManagerImpl;
  private commandHandler: CommandHandler;
  private vscodeIntegration: VSCodeSnippetIntegration;
  private configManager: ConfigurationManager;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.configManager = new ConfigurationManager();

    // Initialize storage service based on configuration
    const storageService = this.createStorageService();
    this.snippetManager = new SnippetManagerImpl(storageService);

    // Initialize integration components
    this.commandHandler = new CommandHandler(
      this.snippetManager,
      this.configManager
    );
    this.vscodeIntegration = new VSCodeSnippetIntegration(this.snippetManager);
  }

  /**
   * Initialize the extension
   */
  async initialize(): Promise<void> {
    try {
      // Initialize the snippet manager
      const initResult = await this.snippetManager.initialize();
      if (!initResult.success) {
        throw new Error(
          `Failed to initialize snippet manager: ${initResult.error.message}`
        );
      }

      // Register all commands
      this.registerCommands();

      // Initialize VS Code snippet integration
      await this.vscodeIntegration.initialize();

      // Set up configuration change listener
      this.setupConfigurationListener();

      // Show activation message
      vscode.window.showInformationMessage(
        "Snippet Library extension activated successfully!"
      );
    } catch (error) {
      console.error("Extension initialization failed:", error);
      throw error;
    }
  }

  /**
   * Register all VS Code commands
   */
  private registerCommands(): void {
    const commands = [
      vscode.commands.registerCommand("snippetLibrary.saveSnippet", () =>
        this.commandHandler.saveSnippet()
      ),
      vscode.commands.registerCommand("snippetLibrary.insertSnippet", () =>
        this.commandHandler.insertSnippet()
      ),
      vscode.commands.registerCommand("snippetLibrary.manageSnippets", () =>
        this.commandHandler.manageSnippets()
      ),
      vscode.commands.registerCommand("snippetLibrary.openWebGUI", () =>
        this.commandHandler.openWebGUI()
      ),
      // Additional utility commands
      vscode.commands.registerCommand("snippetLibrary.refreshSnippets", () =>
        this.commandHandler.refreshSnippets()
      ),
      vscode.commands.registerCommand("snippetLibrary.exportSnippets", () =>
        this.commandHandler.exportSnippets()
      ),
      vscode.commands.registerCommand("snippetLibrary.importSnippets", () =>
        this.commandHandler.importSnippets()
      ),
    ];

    // Add all commands to disposables
    commands.forEach((command) => {
      this.disposables.push(command);
      this.context.subscriptions.push(command);
    });
  }

  /**
   * Set up configuration change listener
   */
  private setupConfigurationListener(): void {
    const configListener = vscode.workspace.onDidChangeConfiguration(
      async (event) => {
        if (event.affectsConfiguration("snippetLibrary")) {
          console.log(
            "Snippet Library configuration changed, reinitializing..."
          );

          try {
            // Recreate storage service with new configuration
            const newStorageService = this.createStorageService();
            const newSnippetManager = new SnippetManagerImpl(newStorageService);

            // Initialize new manager
            const initResult = await newSnippetManager.initialize();
            if (!initResult.success) {
              throw new Error(
                `Failed to reinitialize with new config: ${initResult.error.message}`
              );
            }

            // Update references
            this.snippetManager = newSnippetManager;
            this.commandHandler.updateSnippetManager(newSnippetManager);
            this.vscodeIntegration.updateSnippetManager(newSnippetManager);

            // Refresh VS Code snippet integration
            await this.vscodeIntegration.refreshSnippets();

            vscode.window.showInformationMessage(
              "Snippet Library configuration updated successfully!"
            );
          } catch (error) {
            console.error("Failed to update configuration:", error);
            vscode.window.showErrorMessage(
              `Failed to update Snippet Library configuration: ${
                error instanceof Error ? error.message : error
              }`
            );
          }
        }
      }
    );

    this.disposables.push(configListener);
    this.context.subscriptions.push(configListener);
  }

  /**
   * Create storage service based on current configuration
   */
  private createStorageService() {
    const config = this.configManager.getStorageConfig();

    if (config.location === "workspace") {
      // Use workspace-specific storage
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const workspacePath = workspaceFolder.uri.fsPath;
        return createWorkspaceStorageService(
          `${workspacePath}/.vscode/snippets`
        );
      } else {
        // Fallback to global if no workspace
        console.warn(
          "No workspace folder found, falling back to global storage"
        );
        return createGlobalStorageService();
      }
    } else {
      // Use global storage
      return createGlobalStorageService();
    }
  }

  /**
   * Get the snippet manager instance
   */
  getSnippetManager(): SnippetManagerImpl {
    return this.snippetManager;
  }

  /**
   * Get the VS Code integration instance
   */
  getVSCodeIntegration(): VSCodeSnippetIntegration {
    return this.vscodeIntegration;
  }

  /**
   * Dispose of all resources
   */
  async dispose(): Promise<void> {
    console.log("Disposing Snippet Library extension resources...");

    try {
      // Dispose all registered disposables
      this.disposables.forEach((disposable) => {
        try {
          disposable.dispose();
        } catch (error) {
          console.error("Error disposing resource:", error);
        }
      });

      // Dispose integration components
      if (this.vscodeIntegration) {
        await this.vscodeIntegration.dispose();
      }

      if (this.commandHandler) {
        this.commandHandler.dispose();
      }

      this.disposables = [];
      console.log("Extension resources disposed successfully");
    } catch (error) {
      console.error("Error during extension disposal:", error);
    }
  }
}
