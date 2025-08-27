import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { SnippetManager } from "../../interfaces/SnippetManager";
import {
  Snippet,
  SnippetInterface,
  SearchQuery,
  ImportData,
  ExportData,
  ExportFilter,
} from "../../types";
import { SynchronizationCoordinator } from "../../core/services/SynchronizationCoordinator";

export interface WebGUIServerConfig {
  port: number;
  host: string;
  corsOrigins?: string[];
}

export interface WebGUIServerDependencies {
  snippetManager: SnippetManager;
  syncCoordinator?: SynchronizationCoordinator;
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
    // Serve static files from the client build directory
    const clientBuildPath = path.join(__dirname, "../../client/build");

    // Try to serve static files if build directory exists
    try {
      if (fs.existsSync(clientBuildPath)) {
        this.app.use(express.static(clientBuildPath));
        console.log("Serving React app from:", clientBuildPath);
      } else {
        console.warn(
          "Client build directory not found, serving basic HTML instead"
        );
      }
    } catch (error) {
      console.warn("Error setting up static file serving:", error);
    }

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

    // Serve React app for all non-API routes (SPA fallback)
    this.app.get("*", this.serveFrontend.bind(this));
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

  // Frontend serving method
  private serveFrontend(req: Request, res: Response): void {
    const clientBuildPath = path.join(__dirname, "../../client/build");
    const indexPath = path.join(clientBuildPath, "index.html");

    // Check if built React app exists
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // Serve a basic HTML page with snippet management interface
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Snippet Library - Web GUI</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
              color: #333;
              margin-bottom: 20px;
            }
            .status {
              background: #e8f5e8;
              border: 1px solid #4caf50;
              padding: 15px;
              border-radius: 4px;
              margin-bottom: 20px;
            }
            .api-info {
              background: #f0f8ff;
              border: 1px solid #2196f3;
              padding: 15px;
              border-radius: 4px;
              margin-bottom: 20px;
            }
            .endpoint {
              font-family: 'Courier New', monospace;
              background: #f4f4f4;
              padding: 8px;
              border-radius: 3px;
              margin: 5px 0;
            }
            .note {
              background: #fff3cd;
              border: 1px solid #ffc107;
              padding: 15px;
              border-radius: 4px;
              margin-top: 20px;
            }
            button {
              background: #007acc;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              margin: 5px;
            }
            button:hover {
              background: #005a9e;
            }
            .snippets-container {
              margin-top: 20px;
            }
            .snippet-item {
              border: 1px solid #ddd;
              padding: 15px;
              margin: 10px 0;
              border-radius: 4px;
              background: #fafafa;
            }
            .snippet-title {
              font-weight: bold;
              color: #333;
            }
            .snippet-meta {
              color: #666;
              font-size: 0.9em;
              margin: 5px 0;
            }
            .snippet-code {
              background: #f8f8f8;
              border: 1px solid #e0e0e0;
              padding: 10px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
              white-space: pre-wrap;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 Snippet Library - Web GUI</h1>
            
            <div class="status">
              ✅ <strong>Server Status:</strong> Running on http://${req.get(
                "host"
              )}
            </div>

            <div class="api-info">
              <h3>📡 Available API Endpoints:</h3>
              <div class="endpoint">GET /api/snippets - Get all snippets</div>
              <div class="endpoint">POST /api/snippets - Create new snippet</div>
              <div class="endpoint">GET /api/snippets/:id - Get specific snippet</div>
              <div class="endpoint">PUT /api/snippets/:id - Update snippet</div>
              <div class="endpoint">DELETE /api/snippets/:id - Delete snippet</div>
              <div class="endpoint">GET /api/snippets/search - Search snippets</div>
              <div class="endpoint">GET /health - Server health check</div>
            </div>

            <div>
              <h3>📋 Quick Actions:</h3>
              <button onclick="loadSnippets()">Load Snippets</button>
              <button onclick="testAPI()">Test API</button>
              <button onclick="showStats()">Show Stats</button>
            </div>

            <div id="content" class="snippets-container">
              <p>Click "Load Snippets" to see your snippet collection, or use the VS Code extension to manage snippets.</p>
            </div>

            <div class="note">
              <strong>💡 Note:</strong> This is a basic interface. For the full React-based Web GUI, build the client application first:
              <br><br>
              <code>cd src/webgui/client && npm install && npm run build</code>
            </div>
          </div>

          <script>
            async function loadSnippets() {
              try {
                const response = await fetch('/api/snippets');
                const snippets = await response.json();
                
                const content = document.getElementById('content');
                if (snippets.success === false) {
                  content.innerHTML = '<p style="color: red;">Error: ' + snippets.error.message + '</p>';
                  return;
                }
                
                const snippetData = snippets.data || snippets;
                
                if (snippetData.length === 0) {
                  content.innerHTML = '<p>No snippets found. Create some snippets using the VS Code extension!</p>';
                  return;
                }
                
                content.innerHTML = '<h3>📝 Your Snippets (' + snippetData.length + '):</h3>' +
                  snippetData.map(snippet => 
                    '<div class="snippet-item">' +
                      '<div class="snippet-title">' + (snippet.title || 'Untitled') + '</div>' +
                      '<div class="snippet-meta">Language: ' + (snippet.language || 'Unknown') + 
                      ' | Tags: ' + (snippet.tags ? snippet.tags.join(', ') : 'None') + 
                      ' | Used: ' + (snippet.usageCount || 0) + ' times</div>' +
                      (snippet.description ? '<div style="margin: 5px 0; font-style: italic;">' + snippet.description + '</div>' : '') +
                      '<div class="snippet-code">' + (snippet.code || '').substring(0, 200) + 
                      (snippet.code && snippet.code.length > 200 ? '...' : '') + '</div>' +
                    '</div>'
                  ).join('');
              } catch (error) {
                document.getElementById('content').innerHTML = '<p style="color: red;">Error loading snippets: ' + error.message + '</p>';
              }
            }

            async function testAPI() {
              try {
                const response = await fetch('/health');
                const data = await response.json();
                alert('API Test Successful!\\n\\nServer Status: ' + data.status + '\\nTimestamp: ' + data.timestamp);
              } catch (error) {
                alert('API Test Failed: ' + error.message);
              }
            }

            async function showStats() {
              try {
                const response = await fetch('/api/snippets/stats');
                const stats = await response.json();
                
                let message = 'Snippet Library Statistics:\\n\\n';
                message += 'Total Snippets: ' + stats.total + '\\n';
                message += 'Total Usage: ' + stats.totalUsage + '\\n';
                message += 'Languages: ' + Object.keys(stats.languages).length + '\\n';
                message += 'Tags: ' + Object.keys(stats.tags).length + '\\n';
                
                if (stats.mostUsed) {
                  message += '\\nMost Used: "' + stats.mostUsed.title + '" (' + stats.mostUsed.usageCount + ' times)';
                }
                
                alert(message);
              } catch (error) {
                alert('Error loading stats: ' + error.message);
              }
            }

            // Auto-load snippets on page load
            window.addEventListener('load', loadSnippets);
          </script>
        </body>
        </html>
      `);
    }
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
      const result = await this.dependencies.snippetManager.createSnippet(
        snippetData
      );

      if (!result.success) {
        res.status(400).json({ error: result.error.message });
        return;
      }

      const snippet = result.data;

      // Emit real-time update
      this.emitSnippetUpdate("created", snippet);

      // Notify synchronization coordinator
      if (this.dependencies.syncCoordinator) {
        await this.dependencies.syncCoordinator.handleWebGUIUpdate(
          snippet,
          "created"
        );
      }

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
      const result = await this.dependencies.snippetManager.getSnippet(id);

      if (!result.success) {
        res.status(500).json({ error: result.error.message });
        return;
      }

      if (!result.data) {
        res.status(404).json({ error: "Snippet not found" });
        return;
      }

      res.json(result.data);
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
      const result = await this.dependencies.snippetManager.updateSnippet(
        id,
        updates
      );

      if (!result.success) {
        res.status(400).json({ error: result.error.message });
        return;
      }

      const snippet = result.data;

      // Emit real-time update
      this.emitSnippetUpdate("updated", snippet);

      // Notify synchronization coordinator
      if (this.dependencies.syncCoordinator) {
        await this.dependencies.syncCoordinator.handleWebGUIUpdate(
          snippet,
          "updated"
        );
      }

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
      const snippetResult = await this.dependencies.snippetManager.getSnippet(
        id
      );

      const deleteResult = await this.dependencies.snippetManager.deleteSnippet(
        id
      );

      if (!deleteResult.success) {
        res.status(404).json({ error: "Snippet not found" });
        return;
      }

      // Emit real-time update
      if (snippetResult.success && snippetResult.data) {
        this.emitSnippetUpdate("deleted", snippetResult.data);

        // Notify synchronization coordinator
        if (this.dependencies.syncCoordinator) {
          await this.dependencies.syncCoordinator.handleWebGUIUpdate(
            snippetResult.data,
            "deleted"
          );
        }
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
      if (result.success) {
        this.emitBulkUpdate("imported", result.data.imported);
      }

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
      if (result.success) {
        this.emitBulkUpdate("imported", result.data.imported);
      }

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
      const allSnippetsResult =
        await this.dependencies.snippetManager.searchSnippets({});

      if (!allSnippetsResult.success) {
        res.status(500).json({ error: allSnippetsResult.error.message });
        return;
      }

      const allSnippets = allSnippetsResult.data;

      const stats = {
        total: allSnippets.length,
        languages: {} as Record<string, number>,
        tags: {} as Record<string, number>,
        categories: {} as Record<string, number>,
        totalUsage: 0,
        mostUsed: null as SnippetInterface | null,
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
