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
import {
  SynchronizationCoordinator,
  SynchronizationCoordinatorImpl,
} from "../core/services/SynchronizationCoordinator";
import { WebGUILauncher, WebGUILauncherConfig } from "./WebGUILauncher";

/**
 * Main extension class that coordinates all VS Code integration
 */
export class SnippetLibraryExtension {
  private context: vscode.ExtensionContext;
  private snippetManager: SnippetManagerImpl;
  private commandHandler: CommandHandler;
  private vscodeIntegration: VSCodeSnippetIntegration;
  private configManager: ConfigurationManager;
  private syncCoordinator: SynchronizationCoordinator;
  private webGUILauncher: WebGUILauncher;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.configManager = new ConfigurationManager();

    // Initialize storage service based on configuration
    const storageService = this.createStorageService();
    this.snippetManager = new SnippetManagerImpl(storageService);

    // Initialize synchronization coordinator
    this.syncCoordinator = new SynchronizationCoordinatorImpl();

    // Initialize web GUI launcher
    const webGUIConfig: WebGUILauncherConfig = {
      port: this.configManager.getWebGUIConfig().port,
      host: this.configManager.getWebGUIConfig().host,
      autoStart: this.configManager.getWebGUIConfig().autoStart,
      autoShutdown: this.configManager.getWebGUIConfig().autoShutdown,
      openInBrowser: this.configManager.getWebGUIConfig().openInBrowser,
      healthCheckInterval: 30000, // 30 seconds
      maxStartupRetries: 3,
    };

    this.webGUILauncher = new WebGUILauncher(webGUIConfig, {
      snippetManager: this.snippetManager,
      syncCoordinator: this.syncCoordinator,
    });

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

      // Initialize synchronization coordinator
      await this.initializeSynchronization();

      // Initialize web GUI launcher
      await this.webGUILauncher.initialize();

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
      vscode.commands.registerCommand("snippetLibrary.quickInsertSnippet", () =>
        this.commandHandler.quickInsertSnippet()
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
      // Usage tracking command for snippet completion
      vscode.commands.registerCommand(
        "snippetLibrary.trackUsage",
        (snippetId: string) => this.trackSnippetUsage(snippetId)
      ),
      // Web GUI commands
      vscode.commands.registerCommand("snippetLibrary.launchWebGUI", () =>
        this.webGUILauncher.launchWebGUI()
      ),
      vscode.commands.registerCommand("snippetLibrary.startWebGUIServer", () =>
        this.webGUILauncher.startServer()
      ),
      vscode.commands.registerCommand("snippetLibrary.stopWebGUIServer", () =>
        this.webGUILauncher.stopServer()
      ),
      vscode.commands.registerCommand(
        "snippetLibrary.restartWebGUIServer",
        () => this.webGUILauncher.restartServer()
      ),
      vscode.commands.registerCommand("snippetLibrary.webGUIStatus", () =>
        this.showWebGUIStatus()
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
   * Initialize synchronization coordinator
   */
  private async initializeSynchronization(): Promise<void> {
    try {
      const config = this.configManager.getStorageConfig();
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      let watchPath = "";
      if (config.location === "workspace" && workspaceFolder) {
        watchPath = `${workspaceFolder.uri.fsPath}/.vscode/snippets`;
      } else {
        // For global storage, we'd need to determine the global path
        // For now, skip file watching for global storage
        watchPath = "";
      }

      const syncConfig = {
        sync: {
          enableFileWatching: true,
          enableWebSocketSync: true,
          conflictResolution: "prompt_user" as const,
          maxRetries: 3,
        },
        fileWatcher: {
          watchPath,
          debounceMs: 1000,
          recursive: true,
          ignorePatterns: [".git", "node_modules", ".tmp", "~"],
        },
        webSocket: {
          heartbeatInterval: 30000,
          clientTimeout: 60000,
          maxClients: 10,
        },
        enableAutoSync: true,
        enableConflictResolution: true,
        syncInterval: 30000, // 30 seconds
      };

      const result = await this.syncCoordinator.initialize(
        syncConfig,
        this.snippetManager
      );

      if (result.success) {
        await this.syncCoordinator.start();

        // Set up sync event handlers
        this.setupSyncEventHandlers();

        console.log("Synchronization coordinator initialized successfully");
      } else {
        console.warn(
          "Failed to initialize synchronization:",
          result.error.message
        );
      }
    } catch (error) {
      console.error("Error initializing synchronization:", error);
    }
  }

  /**
   * Set up synchronization event handlers
   */
  private setupSyncEventHandlers(): void {
    // Handle sync events
    this.syncCoordinator.onSyncEvent((event) => {
      console.log("Sync event:", event);

      if (event.type === "sync_failed") {
        vscode.window.showWarningMessage(
          `Synchronization failed: ${event.data.error}`
        );
      }
    });

    // Handle conflict detection
    this.syncCoordinator.onConflictDetected((conflict) => {
      console.log("Conflict detected:", conflict);

      // Show conflict notification to user
      this.showConflictNotification(conflict);
    });
  }

  /**
   * Show conflict notification and handle user response
   */
  private async showConflictNotification(conflict: any): Promise<void> {
    const action = await vscode.window.showWarningMessage(
      `Snippet conflict detected for "${conflict.localSnippet.title}". How would you like to resolve it?`,
      "Use Local Version",
      "Use Remote Version",
      "Merge Changes",
      "Resolve Later"
    );

    if (action && action !== "Resolve Later") {
      let strategy;
      switch (action) {
        case "Use Local Version":
          strategy = { type: "local_wins" as const };
          break;
        case "Use Remote Version":
          strategy = { type: "remote_wins" as const };
          break;
        case "Merge Changes":
          strategy = { type: "merge" as const };
          break;
        default:
          return;
      }

      const result = await this.syncCoordinator.resolveConflict(
        conflict.id,
        strategy
      );
      if (result.success) {
        vscode.window.showInformationMessage("Conflict resolved successfully");

        // Refresh VS Code snippets
        await this.vscodeIntegration.refreshSnippets();
      } else {
        vscode.window.showErrorMessage(
          `Failed to resolve conflict: ${result.error.message}`
        );
      }
    }
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
   * Track snippet usage when inserted via completion
   */
  private async trackSnippetUsage(snippetId: string): Promise<void> {
    try {
      const result = await this.snippetManager.incrementUsage(snippetId);
      if (!result.success) {
        console.error("Failed to track snippet usage:", result.error.message);
      }
    } catch (error) {
      console.error("Error tracking snippet usage:", error);
    }
  }

  /**
   * Show web GUI status information
   */
  private async showWebGUIStatus(): Promise<void> {
    try {
      const status = await this.webGUILauncher.getServerStatus();

      let message = `Web GUI Server Status:\n`;
      message += `Running: ${status.running ? "Yes" : "No"}\n`;

      if (status.running) {
        message += `URL: ${status.url}\n`;
        message += `Healthy: ${status.healthy ? "Yes" : "No"}\n`;
      }

      const actions: string[] = [];

      if (status.running) {
        actions.push("Open in Browser", "Stop Server", "Restart Server");
      } else {
        actions.push("Start Server");
      }

      const action = await vscode.window.showInformationMessage(
        message,
        ...actions
      );

      switch (action) {
        case "Start Server":
          await this.webGUILauncher.startServer();
          break;
        case "Stop Server":
          await this.webGUILauncher.stopServer();
          break;
        case "Restart Server":
          await this.webGUILauncher.restartServer();
          break;
        case "Open in Browser":
          await this.webGUILauncher.openInBrowser();
          break;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to get web GUI status: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
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

      if (this.syncCoordinator) {
        this.syncCoordinator.dispose();
      }

      if (this.webGUILauncher) {
        await this.webGUILauncher.dispose();
      }

      this.disposables = [];
      console.log("Extension resources disposed successfully");
    } catch (error) {
      console.error("Error during extension disposal:", error);
    }
  }
}
