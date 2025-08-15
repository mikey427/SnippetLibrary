import {
  WebGUIServer,
  WebGUIServerConfig,
  WebGUIServerDependencies,
} from "./WebGUIServer";
import { SnippetManager } from "../../interfaces/SnippetManager";

export interface ServerManagerConfig extends WebGUIServerConfig {
  autoStart?: boolean;
  autoRestart?: boolean;
  maxRestartAttempts?: number;
}

export class WebGUIServerManager {
  private server: WebGUIServer | null = null;
  private config: ServerManagerConfig;
  private dependencies: WebGUIServerDependencies;
  private restartAttempts = 0;

  constructor(
    config: ServerManagerConfig,
    dependencies: WebGUIServerDependencies
  ) {
    this.config = {
      maxRestartAttempts: 3,
      autoRestart: true,
      ...config,
    };
    this.dependencies = dependencies;
  }

  public async initialize(): Promise<void> {
    if (this.server) {
      throw new Error("Server manager already initialized");
    }

    this.server = new WebGUIServer(this.config, this.dependencies);

    if (this.config.autoStart) {
      await this.start();
    }
  }

  public async start(): Promise<void> {
    if (!this.server) {
      throw new Error("Server not initialized");
    }

    if (this.server.isRunning()) {
      console.log("Server is already running");
      return;
    }

    try {
      await this.server.start();
      this.restartAttempts = 0;
      console.log(`Web GUI server manager started successfully`);
    } catch (error) {
      console.error("Failed to start server:", error);

      if (
        this.config.autoRestart &&
        this.restartAttempts < (this.config.maxRestartAttempts || 3)
      ) {
        this.restartAttempts++;
        console.log(
          `Attempting restart ${this.restartAttempts}/${this.config.maxRestartAttempts}`
        );

        // Wait before retry
        await new Promise((resolve) =>
          setTimeout(resolve, 2000 * this.restartAttempts)
        );
        await this.start();
      } else {
        throw error;
      }
    }
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    try {
      await this.server.stop();
      console.log("Web GUI server manager stopped");
    } catch (error) {
      console.error("Error stopping server:", error);
      throw error;
    }
  }

  public async restart(): Promise<void> {
    if (!this.server) {
      throw new Error("Server not initialized");
    }

    console.log("Restarting Web GUI server...");
    await this.server.restart();
    this.restartAttempts = 0;
    console.log("Web GUI server restarted successfully");
  }

  public isRunning(): boolean {
    return this.server?.isRunning() || false;
  }

  public getServerUrl(): string {
    if (!this.server || !this.server.isRunning()) {
      throw new Error("Server is not running");
    }

    const config = this.server.getConfig();
    return `http://${config.host}:${config.port}`;
  }

  public getConfig(): ServerManagerConfig {
    return { ...this.config };
  }

  public async updateConfig(
    newConfig: Partial<ServerManagerConfig>
  ): Promise<void> {
    const wasRunning = this.isRunning();

    if (wasRunning) {
      await this.stop();
    }

    this.config = { ...this.config, ...newConfig };

    if (this.server) {
      this.server = new WebGUIServer(this.config, this.dependencies);
    }

    if (wasRunning) {
      await this.start();
    }
  }

  public async dispose(): Promise<void> {
    if (this.server) {
      await this.stop();
      this.server = null;
    }
  }
}
