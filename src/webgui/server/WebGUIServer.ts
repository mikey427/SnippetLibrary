import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { Server } from "http";
import { SnippetManager } from "../../interfaces/SnippetManager";
import { Snippet, SearchQuery, ImportData, ExportData } from "../../types";

export interface WebGUIServerConfig {
  port: number;
  host: string;
  corsOrigins?: string[];
}

export interface WebGUIServerDependencies {
  snippetManager: SnippetManager;
}

export class WebGUIServer {
  private app: Express;
  private server: Server | null = null;
  private config: WebGUIServerConfig;
  private dependencies: WebGUIServerDependencies;

  constructor(
    config: WebGUIServerConfig,
    dependencies: WebGUIServerDependencies
  ) {
    this.config = config;
    this.dependencies = dependencies;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // CORS middleware
    this.app.use(
      cors({
        origin: this.config.corsOrigins || [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ],
        credentials: true,
      })
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", (req: Request, res: Response) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Snippet CRUD endpoints
    this.app.get("/api/snippets", this.getSnippets.bind(this));
    this.app.post("/api/snippets", this.createSnippet.bind(this));

    // Search endpoint (before :id route to avoid conflicts)
    this.app.post("/api/snippets/search", this.searchSnippets.bind(this));

    // Import/Export endpoints (before :id route to avoid conflicts)
    this.app.post("/api/snippets/import", this.importSnippets.bind(this));
    this.app.get("/api/snippets/export", this.exportSnippets.bind(this));

    // ID-specific routes (must come after specific routes)
    this.app.get("/api/snippets/:id", this.getSnippet.bind(this));
    this.app.put("/api/snippets/:id", this.updateSnippet.bind(this));
    this.app.delete("/api/snippets/:id", this.deleteSnippet.bind(this));
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: "Not Found",
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Global error handler
    this.app.use(
      (error: Error, req: Request, res: Response, next: NextFunction) => {
        console.error("Server error:", error);
        res.status(500).json({
          error: "Internal Server Error",
          message: error.message,
          ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
        });
      }
    );
  }

  // Route handlers
  private async getSnippets(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const snippets = await this.dependencies.snippetManager.searchSnippets(
        {}
      );
      res.json(snippets);
    } catch (error) {
      next(error);
    }
  }

  private async createSnippet(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const snippetData = req.body;
      const snippet = await this.dependencies.snippetManager.createSnippet(
        snippetData
      );
      res.status(201).json(snippet);
    } catch (error) {
      next(error);
    }
  }

  private async getSnippet(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const snippet = await this.dependencies.snippetManager.getSnippet(id);

      if (!snippet) {
        res.status(404).json({ error: "Snippet not found" });
        return;
      }

      res.json(snippet);
    } catch (error) {
      next(error);
    }
  }

  private async updateSnippet(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      const snippet = await this.dependencies.snippetManager.updateSnippet(
        id,
        updates
      );
      res.json(snippet);
    } catch (error) {
      next(error);
    }
  }

  private async deleteSnippet(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.dependencies.snippetManager.deleteSnippet(id);

      if (!success) {
        res.status(404).json({ error: "Snippet not found" });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  private async searchSnippets(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query: SearchQuery = req.body;
      const snippets = await this.dependencies.snippetManager.searchSnippets(
        query
      );
      res.json(snippets);
    } catch (error) {
      next(error);
    }
  }

  private async importSnippets(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const importData: ImportData = req.body;
      const result = await this.dependencies.snippetManager.importSnippets(
        importData
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  private async exportSnippets(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const filter = req.query;
      const exportData = await this.dependencies.snippetManager.exportSnippets(
        filter
      );

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="snippets-export.json"'
      );
      res.json(exportData);
    } catch (error) {
      next(error);
    }
  }

  // Server lifecycle methods
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        reject(new Error("Server is already running"));
        return;
      }

      this.server = this.app.listen(this.config.port, this.config.host, () => {
        console.log(
          `Web GUI server started on http://${this.config.host}:${this.config.port}`
        );
        resolve();
      });

      this.server.on("error", (error) => {
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          console.log("Web GUI server stopped");
          this.server = null;
          resolve();
        }
      });
    });
  }

  public async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  public isRunning(): boolean {
    return this.server !== null;
  }

  public getConfig(): WebGUIServerConfig {
    return { ...this.config };
  }

  public getApp(): Express {
    return this.app;
  }
}
