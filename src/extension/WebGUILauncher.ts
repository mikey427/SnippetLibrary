import * as vscode from "vscode";
import {
  WebGUIServerManager,
  ServerManagerConfig,
} from "../webgui/server/WebGUIServerManager";
import { SnippetManager } from "../interfaces/SnippetManager";
import { SynchronizationCoordinator } from "../core/services/SynchronizationCoordinator";

export interface WebGUILauncherConfig {
  port: number;
  host: string;
  autoStart: boolean;
  autoShutdown: boolean;
  openInBrowser: boolean;
  healthCheckInterval: number;
  maxStartupRetries: number;
}

export interface WebGUILauncherDependencies {
  snippetManager: SnippetManager;
  syncCoordinator?: SynchronizationCoordinator;
}

/**
 * Manages the web GUI server lifecycle and browser integration for VS Code
 */
export class WebGUILauncher {
  private serverManager: WebGUIServerManager | null = null;
  private config: WebGUILauncherConfig;
  private dependencies: WebGUILauncherDependencies;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor(
    config: WebGUILauncherConfig,
    dependencies: WebGUILauncherDependencies
  ) {
    this.config = config;
    this.dependencies = dependencies;
  }

  /**
   * Initialize the launcher and set up VS Code integration
   */
  async initialize(): Promise<void> {
    // Create server manager
    const serverConfig: ServerManagerConfig = {
      port: this.config.port,
      host: this.config.host,
      autoStart: false, // We'll control startup manually
      autoRestart: true,
      maxRestartAttempts: this.config.maxStartupRetries,
    };

    this.serverManager = new WebGUIServerManager(serverConfig, {
      snippetManager: this.dependencies.snippetManager,
      syncCoordinator: this.dependencies.syncCoordinator,
    });

    await this.serverManager.initialize();

    // Set up VS Code lifecycle handlers
    this.setupVSCodeIntegration();

    // Auto-start if configured
    if (this.config.autoStart) {
      await this.startServer();
    }
  }

  /**
   * Set up VS Code integration and lifecycle handlers
   */
  private setupVSCodeIntegration(): void {
    // Handle VS Code window close
    const windowCloseHandler = vscode.window.onDidChangeWindowState((state) => {
      if (!state.focused && this.config.autoShutdown) {
        // Check if VS Code is being closed (simplified check)
        setTimeout(async () => {
          if (!vscode.window.state.focused) {
            await this.handleVSCodeExit();
          }
        }, 5000); // Wait 5 seconds to see if focus returns
      }
    });

    this.disposables.push(windowCloseHandler);
  }

  /**
   * Launch the web GUI (start server and open browser)
   */
  async launchWebGUI(): Promise<void> {
    try {
      // Start server if not running
      if (!this.isServerRunning()) {
        await this.startServer();
      }

      // Open in browser
      if (this.config.openInBrowser) {
        await this.openInBrowser();
      }

      // Show success message
      const serverUrl = this.getServerUrl();
      vscode.window
        .showInformationMessage(
          `Web GUI launched successfully at ${serverUrl}`,
          "Open in Browser",
          "Copy URL"
        )
        .then((action) => {
          if (action === "Open in Browser") {
            this.openInBrowser();
          } else if (action === "Copy URL") {
            vscode.env.clipboard.writeText(serverUrl);
            vscode.window.showInformationMessage("URL copied to clipboard");
          }
        });
    } catch (error) {
      console.error("Failed to launch web GUI:", error);
      vscode.window.showErrorMessage(
        `Failed to launch web GUI: ${
          error instanceof Error ? error.message : error
        }`
      );
      throw error;
    }
  }

  /**
   * Start the web GUI server
   */
  async startServer(): Promise<void> {
    if (!this.serverManager) {
      throw new Error("Server manager not initialized");
    }

    try {
      // Show progress notification
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Starting Web GUI Server",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Initializing server..." });

          await this.serverManager!.start();

          progress.report({ message: "Performing health check..." });

          // Wait for server to be ready
          await this.waitForServerReady();

          progress.report({ message: "Server ready!" });
        }
      );

      // Start health monitoring
      this.startHealthMonitoring();

      console.log("Web GUI server started successfully");
    } catch (error) {
      console.error("Failed to start web GUI server:", error);
      throw error;
    }
  }

  /**
   * Stop the web GUI server
   */
  async stopServer(): Promise<void> {
    if (!this.serverManager) {
      return;
    }

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      // Stop server
      await this.serverManager.stop();

      vscode.window.showInformationMessage("Web GUI server stopped");
      console.log("Web GUI server stopped successfully");
    } catch (error) {
      console.error("Failed to stop web GUI server:", error);
      vscode.window.showErrorMessage(
        `Failed to stop web GUI server: ${
          error instanceof Error ? error.message : error
        }`
      );
      throw error;
    }
  }

  /**
   * Restart the web GUI server
   */
  async restartServer(): Promise<void> {
    if (!this.serverManager) {
      throw new Error("Server manager not initialized");
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Restarting Web GUI Server",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Stopping server..." });
          await this.stopServer();

          progress.report({ message: "Starting server..." });
          await this.startServer();
        }
      );

      vscode.window.showInformationMessage(
        "Web GUI server restarted successfully"
      );
    } catch (error) {
      console.error("Failed to restart web GUI server:", error);
      vscode.window.showErrorMessage(
        `Failed to restart web GUI server: ${
          error instanceof Error ? error.message : error
        }`
      );
      throw error;
    }
  }

  /**
   * Open the web GUI in the default browser
   */
  async openInBrowser(): Promise<void> {
    try {
      const serverUrl = this.getServerUrl();
      await vscode.env.openExternal(vscode.Uri.parse(serverUrl));
      console.log(`Opened web GUI in browser: ${serverUrl}`);
    } catch (error) {
      console.error("Failed to open web GUI in browser:", error);
      vscode.window.showErrorMessage(
        `Failed to open web GUI in browser: ${
          error instanceof Error ? error.message : error
        }`
      );
      throw error;
    }
  }

  /**
   * Get the server URL
   */
  getServerUrl(): string {
    if (!this.serverManager || !this.serverManager.isRunning()) {
      throw new Error("Server is not running");
    }

    return this.serverManager.getServerUrl();
  }

  /**
   * Check if the server is running
   */
  isServerRunning(): boolean {
    return this.serverManager?.isRunning() || false;
  }

  /**
   * Get server status information
   */
  async getServerStatus(): Promise<{
    running: boolean;
    url?: string;
    healthy?: boolean;
    uptime?: number;
  }> {
    const running = this.isServerRunning();

    if (!running) {
      return { running: false };
    }

    try {
      const url = this.getServerUrl();
      const healthy = await this.performHealthCheck();

      return {
        running: true,
        url,
        healthy,
        uptime: Date.now(), // Simplified - would need to track actual start time
      };
    } catch (error) {
      return {
        running: true,
        healthy: false,
      };
    }
  }

  /**
   * Wait for server to be ready with health checks
   */
  private async waitForServerReady(maxAttempts: number = 10): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const healthy = await this.performHealthCheck();
        if (healthy) {
          return;
        }
      } catch (error) {
        // Health check failed, continue trying
      }

      if (attempt < maxAttempts) {
        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error("Server failed to become ready within timeout");
  }

  /**
   * Perform a health check on the server
   */
  private async performHealthCheck(): Promise<boolean> {
    if (!this.isServerRunning()) {
      return false;
    }

    try {
      const serverUrl = this.getServerUrl();

      // Use Node.js http module for health check
      const http = require("http");
      const url = require("url");

      return new Promise<boolean>((resolve) => {
        const parsedUrl = url.parse(`${serverUrl}/health`);
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.path,
          method: "GET",
          timeout: 5000, // 5 second timeout
        };

        const req = http.request(options, (res: any) => {
          resolve(res.statusCode === 200);
        });

        req.on("error", () => {
          resolve(false);
        });

        req.on("timeout", () => {
          req.destroy();
          resolve(false);
        });

        req.end();
      });
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      return; // Already monitoring
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        const healthy = await this.performHealthCheck();
        if (!healthy && this.isServerRunning()) {
          console.warn("Web GUI server health check failed");

          // Optionally show warning to user
          vscode.window
            .showWarningMessage(
              "Web GUI server appears to be unhealthy",
              "Restart Server",
              "Stop Server"
            )
            .then((action) => {
              if (action === "Restart Server") {
                this.restartServer();
              } else if (action === "Stop Server") {
                this.stopServer();
              }
            });
        }
      } catch (error) {
        console.error("Error during health monitoring:", error);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Handle VS Code exit
   */
  private async handleVSCodeExit(): Promise<void> {
    if (this.config.autoShutdown && this.isServerRunning()) {
      try {
        console.log("VS Code is closing, shutting down web GUI server...");
        await this.stopServer();
      } catch (error) {
        console.error("Error during graceful shutdown:", error);
      }
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<WebGUILauncherConfig>): Promise<void> {
    const wasRunning = this.isServerRunning();

    // Update config
    this.config = { ...this.config, ...newConfig };

    // Update server manager config if needed
    if (this.serverManager && (newConfig.port || newConfig.host)) {
      const serverConfig: Partial<ServerManagerConfig> = {};
      if (newConfig.port) serverConfig.port = newConfig.port;
      if (newConfig.host) serverConfig.host = newConfig.host;

      await this.serverManager.updateConfig(serverConfig);
    }

    // Restart health monitoring with new interval if changed
    if (newConfig.healthCheckInterval && this.healthCheckTimer) {
      this.stopHealthMonitoring();
      if (wasRunning) {
        this.startHealthMonitoring();
      }
    }
  }

  /**
   * Dispose of all resources
   */
  async dispose(): Promise<void> {
    console.log("Disposing WebGUI launcher resources...");

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      // Dispose VS Code integrations
      this.disposables.forEach((disposable) => {
        try {
          disposable.dispose();
        } catch (error) {
          console.error("Error disposing resource:", error);
        }
      });
      this.disposables = [];

      // Stop server if running
      if (this.serverManager) {
        await this.serverManager.dispose();
        this.serverManager = null;
      }

      console.log("WebGUI launcher disposed successfully");
    } catch (error) {
      console.error("Error during WebGUI launcher disposal:", error);
    }
  }
}
