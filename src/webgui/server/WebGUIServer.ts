import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import { SnippetManager } from "../../interfaces/SnippetManager";
import {
  Snippet,
  SearchQuery,
  ImportData,
  ExportData,
  ExportFilter,
} from "../../types";

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
  private io: SocketIOServer | null = null;
  private config: WebGUIServerConfig;
  private dependencies: WebGUIServerDependencies;
  private upload: multer.Multer;

  constructor(
    config: WebGUIServerConfig,
    dependencies: WebGUIServerDependencies
  ) {
    this.config = config;
    this.dependencies = dependencies;
    this.app = express();

    // Configure multer for file uploads
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        // Accept JSON and YAML files
        if (
          file.mimetype === "application/json" ||
          file.originalname.endsWith(".json") ||
          file.originalname.endsWith(".yaml") ||
          file.originalname.endsWith(".yml")
        ) {
          cb(null, true);
        } else {
          cb(new Error("Only JSON and YAML files are allowed"));
        }
      },
    });

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

    // Enhanced search endpoints (before :id route to avoid conflicts)
    this.app.get("/api/snippets/search", this.searchSnippetsGet.bind(this));
    this.app.post("/api/snippets/search", this.searchSnippets.bind(this));

    // Import/Export endpoints with file handling (before :id route to avoid conflicts)
    this.app.post(
      "/api/snippets/import",
      this.upload.single("file"),
      this.importSnippets.bind(this)
    );
    this.app.post(
      "/api/snippets/import/json",
      this.importSnippetsJson.bind(this)
    );
    this.app.get("/api/snippets/export", this.exportSnippets.bind(this));
    this.app.post("/api/snippets/export", this.exportSnippetsPost.bind(this));

    // Bulk operations endpoints
    this.app.post(
      "/api/snippets/bulk/delete",
      this.bulkDeleteSnippets.bind(this)
    );
    this.app.post(
      "/api/snippets/bulk/update",
      this.bulkUpdateSnippets.bind(this)
    );

    // Statistics endpoint
    this.app.get("/api/snippets/stats", this.getSnippetStats.bind(this));

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
      // Support query parameters for basic filtering
      const query: SearchQuery = {};

      if (req.query.language) {
        query.language = req.query.language as string;
      }

      if (req.query.tags) {
        const tags = Array.isArray(req.query.tags)
          ? (req.query.tags as string[])
          : [req.query.tags as string];
        query.tags = tags;
      }

      if (req.query.category) {
        query.category = req.query.category as string;
      }

      if (req.query.sortBy) {
        query.sortBy = req.query.sortBy as "title" | "createdAt" | "usageCount";
      }

      if (req.query.sortOrder) {
        query.sortOrder = req.query.sortOrder as "asc" | "desc";
      }

      const snippets = await this.dependencies.snippetManager.searchSnippets(
        query
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

      // Emit real-time update
      this.emitSnippetUpdate("created", snippet);

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

      // Emit real-time update
      this.emitSnippetUpdate("updated", snippet);

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

      // Get snippet before deletion for real-time update
      const snippet = await this.dependencies.snippetManager.getSnippet(id);

      const success = await this.dependencies.snippetManager.deleteSnippet(id);

      if (!success) {
        res.status(404).json({ error: "Snippet not found" });
        return;
      }

      // Emit real-time update
      if (snippet) {
        this.emitSnippetUpdate("deleted", snippet);
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  private async searchSnippetsGet(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query: SearchQuery = {};

      // Parse query parameters
      if (req.query.text) {
        query.text = req.query.text as string;
      }

      if (req.query.language) {
        query.language = req.query.language as string;
      }

      if (req.query.tags) {
        const tags = Array.isArray(req.query.tags)
          ? (req.query.tags as string[])
          : (req.query.tags as string).split(",");
        query.tags = tags;
      }

      if (req.query.category) {
        query.category = req.query.category as string;
      }

      if (req.query.sortBy) {
        query.sortBy = req.query.sortBy as "title" | "createdAt" | "usageCount";
      }

      if (req.query.sortOrder) {
        query.sortOrder = req.query.sortOrder as "asc" | "desc";
      }

      // Parse date range
      if (req.query.startDate && req.query.endDate) {
        query.dateRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string),
        };
      }

      const snippets = await this.dependencies.snippetManager.searchSnippets(
        query
      );
      res.json(snippets);
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
      let importData: ImportData;

      // Handle both file upload and JSON body
      if (req.file) {
        // File upload case
        try {
          const fileContent = req.file.buffer.toString("utf8");
          const parsedData = JSON.parse(fileContent);

          // Handle different import formats
          if (parsedData.snippets && Array.isArray(parsedData.snippets)) {
            // Full export format
            importData = {
              snippets: parsedData.snippets,
              conflictResolution:
                (req.body.conflictResolution as
                  | "skip"
                  | "overwrite"
                  | "rename") || "skip",
            };
          } else if (Array.isArray(parsedData)) {
            // Simple array format
            importData = {
              snippets: parsedData,
              conflictResolution:
                (req.body.conflictResolution as
                  | "skip"
                  | "overwrite"
                  | "rename") || "skip",
            };
          } else {
            res.status(400).json({ error: "Invalid file format" });
            return;
          }
        } catch (parseError) {
          res.status(400).json({ error: "Invalid JSON file" });
          return;
        }
      } else if (req.body && (req.body.snippets || Array.isArray(req.body))) {
        // JSON body case (backward compatibility)
        if (req.body.snippets) {
          importData = req.body as ImportData;
        } else {
          // Direct array of snippets
          importData = {
            snippets: req.body,
            conflictResolution: "skip",
          };
        }
      } else {
        res
          .status(400)
          .json({ error: "No file uploaded or invalid JSON body" });
        return;
      }

      const result = await this.dependencies.snippetManager.importSnippets(
        importData
      );

      // Emit real-time update for bulk import
      this.emitBulkUpdate("imported", result.imported);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  private async importSnippetsJson(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const importData: ImportData = req.body;
      const result = await this.dependencies.snippetManager.importSnippets(
        importData
      );

      // Emit real-time update for bulk import
      this.emitBulkUpdate("imported", result.imported);

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
      // For backward compatibility, pass query parameters as-is to the snippet manager
      // The snippet manager should handle the filtering logic
      const filter = req.query as any;

      const exportData = await this.dependencies.snippetManager.exportSnippets(
        filter
      );

      const filename = "snippets-export.json";

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.json(exportData);
    } catch (error) {
      next(error);
    }
  }

  private async exportSnippetsPost(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const filter: ExportFilter = req.body;
      const exportData = await this.dependencies.snippetManager.exportSnippets(
        filter
      );

      const filename = "snippets-export.json";

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.json(exportData);
    } catch (error) {
      next(error);
    }
  }

  // New route handlers for enhanced functionality
  private async bulkDeleteSnippets(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids)) {
        res.status(400).json({ error: "ids must be an array" });
        return;
      }

      const results = {
        deleted: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const id of ids) {
        try {
          const success = await this.dependencies.snippetManager.deleteSnippet(
            id
          );
          if (success) {
            results.deleted++;
          } else {
            results.failed++;
            results.errors.push(`Snippet ${id} not found`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed to delete ${id}: ${error}`);
        }
      }

      // Emit bulk update
      this.emitBulkUpdate("deleted", results.deleted);

      res.json(results);
    } catch (error) {
      next(error);
    }
  }

  private async bulkUpdateSnippets(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { ids, updates } = req.body;

      if (!Array.isArray(ids)) {
        res.status(400).json({ error: "ids must be an array" });
        return;
      }

      const results = {
        updated: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const id of ids) {
        try {
          await this.dependencies.snippetManager.updateSnippet(id, updates);
          results.updated++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed to update ${id}: ${error}`);
        }
      }

      // Emit bulk update
      this.emitBulkUpdate("updated", results.updated);

      res.json(results);
    } catch (error) {
      next(error);
    }
  }

  private async getSnippetStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const allSnippets = await this.dependencies.snippetManager.searchSnippets(
        {}
      );

      const stats = {
        total: allSnippets.length,
        languages: {} as Record<string, number>,
        tags: {} as Record<string, number>,
        categories: {} as Record<string, number>,
        totalUsage: 0,
        mostUsed: null as Snippet | null,
        recentlyCreated: allSnippets
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 5),
        recentlyUpdated: allSnippets
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          .slice(0, 5),
      };

      let maxUsage = 0;

      for (const snippet of allSnippets) {
        // Language stats
        stats.languages[snippet.language] =
          (stats.languages[snippet.language] || 0) + 1;

        // Tag stats
        for (const tag of snippet.tags) {
          stats.tags[tag] = (stats.tags[tag] || 0) + 1;
        }

        // Category stats
        if (snippet.category) {
          stats.categories[snippet.category] =
            (stats.categories[snippet.category] || 0) + 1;
        }

        // Usage stats
        stats.totalUsage += snippet.usageCount;
        if (snippet.usageCount > maxUsage) {
          maxUsage = snippet.usageCount;
          stats.mostUsed = snippet;
        }
      }

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  // WebSocket functionality
  private setupWebSocket(): void {
    if (!this.server) return;

    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: this.config.corsOrigins || [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ],
        methods: ["GET", "POST"],
      },
    });

    this.io.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
      });

      // Send initial connection confirmation
      socket.emit("connected", {
        message: "Connected to snippet library server",
        timestamp: new Date().toISOString(),
      });
    });
  }

  private emitSnippetUpdate(
    action: "created" | "updated" | "deleted",
    snippet: Snippet
  ): void {
    if (this.io) {
      this.io.emit("snippetUpdate", {
        action,
        snippet,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private emitBulkUpdate(
    action: "imported" | "deleted" | "updated",
    count: number
  ): void {
    if (this.io) {
      this.io.emit("bulkUpdate", {
        action,
        count,
        timestamp: new Date().toISOString(),
      });
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

        // Setup WebSocket after server starts
        this.setupWebSocket();

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

          // Close WebSocket server
          if (this.io) {
            this.io.close();
            this.io = null;
          }

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
