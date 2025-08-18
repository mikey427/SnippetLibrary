import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { io as ioClient, Socket } from "socket.io-client";
import {
  WebGUIServerManager,
  ServerManagerConfig,
} from "../WebGUIServerManager";
import { WebGUIServerDependencies } from "../WebGUIServer";
import { SnippetManager } from "../../../interfaces/SnippetManager";
import {
  Snippet,
  SearchQuery,
  ImportData,
  ExportData,
  ExportFilter,
} from "../../../types";

// Enhanced Mock SnippetManager for comprehensive testing
class EnhancedMockSnippetManager implements SnippetManager {
  private snippets: Map<string, Snippet> = new Map();
  private nextId = 1;

  async createSnippet(snippetData: any): Promise<Snippet> {
    const snippet: Snippet = {
      id: snippetData.id || `snippet-${this.nextId++}`,
      title: snippetData.title,
      description: snippetData.description || "",
      code: snippetData.code,
      language: snippetData.language,
      tags: snippetData.tags || [],
      category: snippetData.category,
      createdAt: snippetData.createdAt || new Date(),
      updatedAt: snippetData.updatedAt || new Date(),
      usageCount: snippetData.usageCount || 0,
      prefix: snippetData.prefix,
      scope: snippetData.scope,
    };

    this.snippets.set(snippet.id, snippet);
    return snippet;
  }

  async getSnippet(id: string): Promise<Snippet | null> {
    return this.snippets.get(id) || null;
  }

  async updateSnippet(id: string, updates: Partial<any>): Promise<Snippet> {
    const existing = this.snippets.get(id);
    if (!existing) {
      throw new Error("Snippet not found");
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.snippets.set(id, updated);
    return updated;
  }

  async deleteSnippet(id: string): Promise<boolean> {
    return this.snippets.delete(id);
  }

  async searchSnippets(query: SearchQuery): Promise<Snippet[]> {
    let results = Array.from(this.snippets.values());

    if (query.text) {
      const searchText = query.text.toLowerCase();
      results = results.filter(
        (s) =>
          s.title.toLowerCase().includes(searchText) ||
          s.code.toLowerCase().includes(searchText) ||
          s.description.toLowerCase().includes(searchText)
      );
    }

    if (query.language) {
      results = results.filter((s) => s.language === query.language);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter((s) =>
        query.tags!.some((tag) => s.tags.includes(tag))
      );
    }

    if (query.category) {
      results = results.filter((s) => s.category === query.category);
    }

    if (query.dateRange) {
      results = results.filter((s) => {
        const createdAt = new Date(s.createdAt);
        return (
          createdAt >= query.dateRange!.start &&
          createdAt <= query.dateRange!.end
        );
      });
    }

    // Apply sorting
    if (query.sortBy) {
      results.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (query.sortBy) {
          case "title":
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          case "createdAt":
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
          case "usageCount":
            aValue = a.usageCount;
            bValue = b.usageCount;
            break;
          default:
            return 0;
        }

        if (query.sortOrder === "desc") {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        } else {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        }
      });
    }

    return results;
  }

  async importSnippets(data: ImportData): Promise<any> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const conflicts: any[] = [];

    for (const snippetData of data.snippets) {
      try {
        const existingSnippet = this.snippets.get(snippetData.id);

        if (existingSnippet) {
          if (data.conflictResolution === "skip") {
            skipped++;
            continue;
          } else if (data.conflictResolution === "rename") {
            // Generate new ID for renamed snippet
            const newId = `${snippetData.id}-renamed-${Date.now()}`;
            const renamedSnippet = { ...snippetData, id: newId };
            await this.createSnippet(renamedSnippet);
            conflicts.push({
              existingSnippet,
              newSnippet: snippetData,
              resolution: "rename",
              newName: newId,
            });
            imported++;
          } else {
            // Overwrite
            await this.updateSnippet(snippetData.id, snippetData);
            imported++;
          }
        } else {
          await this.createSnippet(snippetData);
          imported++;
        }
      } catch (error) {
        errors.push(`Failed to import snippet ${snippetData.id}: ${error}`);
      }
    }

    return { imported, skipped, errors, conflicts };
  }

  async exportSnippets(filter?: ExportFilter): Promise<ExportData> {
    let snippets = Array.from(this.snippets.values());

    if (filter?.languages && filter.languages.length > 0) {
      snippets = snippets.filter((s) => filter.languages!.includes(s.language));
    }

    if (filter?.tags && filter.tags.length > 0) {
      snippets = snippets.filter((s) =>
        filter.tags!.some((tag) => s.tags.includes(tag))
      );
    }

    if (filter?.categories && filter.categories.length > 0) {
      snippets = snippets.filter(
        (s) => s.category && filter.categories!.includes(s.category)
      );
    }

    if (filter?.dateRange) {
      snippets = snippets.filter((s) => {
        const createdAt = new Date(s.createdAt);
        return (
          createdAt >= filter.dateRange!.start &&
          createdAt <= filter.dateRange!.end
        );
      });
    }

    return {
      snippets,
      metadata: {
        exportedAt: new Date(),
        version: "1.0.0",
        count: snippets.length,
      },
    };
  }

  // Helper methods for testing
  clear(): void {
    this.snippets.clear();
    this.nextId = 1;
  }

  size(): number {
    return this.snippets.size;
  }

  getAllSnippets(): Snippet[] {
    return Array.from(this.snippets.values());
  }
}

describe("Enhanced API Features", () => {
  let serverManager: WebGUIServerManager;
  let mockSnippetManager: EnhancedMockSnippetManager;
  let config: ServerManagerConfig;
  let dependencies: WebGUIServerDependencies;
  let baseUrl: string;
  let socketClient: Socket;

  beforeEach(async () => {
    mockSnippetManager = new EnhancedMockSnippetManager();

    config = {
      port: 0, // Use random port for testing
      host: "localhost",
      autoStart: false,
    };

    dependencies = {
      snippetManager: mockSnippetManager,
    };

    serverManager = new WebGUIServerManager(config, dependencies);
    await serverManager.initialize();
    await serverManager.start();

    baseUrl = serverManager.getServerUrl();
  });

  afterEach(async () => {
    if (socketClient) {
      socketClient.disconnect();
    }
    await serverManager.dispose();
    mockSnippetManager.clear();
  });

  describe("Advanced Search with Query Parameters", () => {
    beforeEach(async () => {
      // Create comprehensive test data
      const testSnippets = [
        {
          title: "React Component",
          code: "const Component = () => <div>Hello</div>;",
          language: "javascript",
          tags: ["react", "component", "frontend"],
          category: "components",
          usageCount: 15,
          createdAt: new Date("2024-01-01"),
        },
        {
          title: "Python Data Processing",
          code: 'import pandas as pd\ndf = pd.read_csv("data.csv")',
          language: "python",
          tags: ["data", "pandas", "processing"],
          category: "data-science",
          usageCount: 8,
          createdAt: new Date("2024-01-15"),
        },
        {
          title: "CSS Grid Layout",
          code: ".grid { display: grid; grid-template-columns: 1fr 1fr; }",
          language: "css",
          tags: ["css", "grid", "layout"],
          category: "styling",
          usageCount: 22,
          createdAt: new Date("2024-02-01"),
        },
        {
          title: "TypeScript Interface",
          code: "interface User { id: number; name: string; }",
          language: "typescript",
          tags: ["typescript", "interface", "types"],
          category: "types",
          usageCount: 5,
          createdAt: new Date("2024-02-15"),
        },
      ];

      for (const snippet of testSnippets) {
        await mockSnippetManager.createSnippet(snippet);
      }
    });

    it("should search with complex text queries", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?text=component")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe("React Component");
    });

    it("should filter by multiple languages", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?language=javascript")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].language).toBe("javascript");
    });

    it("should filter by multiple tags", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?tags=frontend,react")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].tags).toContain("react");
    });

    it("should sort by usage count descending", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?sortBy=usageCount&sortOrder=desc")
        .expect(200);

      expect(response.body[0].usageCount).toBe(22); // CSS Grid Layout
      expect(response.body[1].usageCount).toBe(15); // React Component
      expect(response.body[2].usageCount).toBe(8); // Python Data Processing
      expect(response.body[3].usageCount).toBe(5); // TypeScript Interface
    });

    it("should sort by title ascending", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?sortBy=title&sortOrder=asc")
        .expect(200);

      expect(response.body[0].title).toBe("CSS Grid Layout");
      expect(response.body[1].title).toBe("Python Data Processing");
      expect(response.body[2].title).toBe("React Component");
      expect(response.body[3].title).toBe("TypeScript Interface");
    });

    it("should combine multiple filters", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?category=styling&language=css&tags=grid")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe("CSS Grid Layout");
    });

    it("should handle date range filtering", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?startDate=2024-01-01&endDate=2024-01-31")
        .expect(200);

      expect(response.body).toHaveLength(2); // React Component and Python Data Processing
    });
  });

  describe("File Upload Import/Export", () => {
    it("should handle various export formats", async () => {
      // Create test data
      await mockSnippetManager.createSnippet({
        title: "Export Test",
        code: 'console.log("export");',
        language: "javascript",
        tags: ["export", "test"],
        category: "testing",
      });

      const response = await request(baseUrl)
        .get("/api/snippets/export")
        .expect(200);

      expect(response.body.snippets).toHaveLength(1);
      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.count).toBe(1);
      expect(response.body.metadata.version).toBe("1.0.0");
      expect(response.body.metadata.exportedAt).toBeDefined();
    });

    it("should export with complex filtering", async () => {
      // Create diverse test data
      const snippets = [
        {
          title: "JS Test 1",
          code: 'console.log("js1");',
          language: "javascript",
          tags: ["test", "js"],
          category: "testing",
          createdAt: new Date("2024-01-01"),
        },
        {
          title: "JS Test 2",
          code: 'console.log("js2");',
          language: "javascript",
          tags: ["test", "advanced"],
          category: "advanced",
          createdAt: new Date("2024-02-01"),
        },
        {
          title: "Python Test",
          code: 'print("python")',
          language: "python",
          tags: ["test", "py"],
          category: "testing",
          createdAt: new Date("2024-01-15"),
        },
      ];

      for (const snippet of snippets) {
        await mockSnippetManager.createSnippet(snippet);
      }

      // Export with multiple filters
      const response = await request(baseUrl)
        .post("/api/snippets/export")
        .send({
          languages: ["javascript"],
          tags: ["test"],
          categories: ["testing"],
          dateRange: {
            start: new Date("2024-01-01"),
            end: new Date("2024-01-31"),
          },
        })
        .expect(200);

      expect(response.body.snippets).toHaveLength(1);
      expect(response.body.snippets[0].title).toBe("JS Test 1");
    });

    it("should import from file with conflict resolution", async () => {
      // Create initial snippet
      await mockSnippetManager.createSnippet({
        id: "conflict-test",
        title: "Original",
        code: 'console.log("original");',
        language: "javascript",
        tags: ["original"],
      });

      const importData = {
        snippets: [
          {
            id: "conflict-test",
            title: "Updated",
            code: 'console.log("updated");',
            language: "javascript",
            tags: ["updated"],
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
          },
          {
            id: "new-snippet",
            title: "New Snippet",
            code: 'console.log("new");',
            language: "javascript",
            tags: ["new"],
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
          },
        ],
      };

      const fileBuffer = Buffer.from(JSON.stringify(importData));

      // Test skip resolution
      const skipResponse = await request(baseUrl)
        .post("/api/snippets/import")
        .attach("file", fileBuffer, "snippets.json")
        .field("conflictResolution", "skip")
        .expect(200);

      expect(skipResponse.body.imported).toBe(1); // Only new snippet
      expect(skipResponse.body.skipped).toBe(1); // Conflicting snippet

      // Test overwrite resolution
      const overwriteResponse = await request(baseUrl)
        .post("/api/snippets/import")
        .attach("file", fileBuffer, "snippets.json")
        .field("conflictResolution", "overwrite")
        .expect(200);

      expect(overwriteResponse.body.imported).toBe(2); // Both snippets
      expect(overwriteResponse.body.skipped).toBe(0);

      // Verify overwrite worked
      const snippet = await mockSnippetManager.getSnippet("conflict-test");
      expect(snippet?.title).toBe("Updated");
    });

    it("should handle different import file formats", async () => {
      // Test simple array format
      const simpleArray = [
        {
          id: "simple-1",
          title: "Simple 1",
          code: 'console.log("simple1");',
          language: "javascript",
          tags: ["simple"],
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0,
        },
      ];

      const simpleBuffer = Buffer.from(JSON.stringify(simpleArray));

      const response = await request(baseUrl)
        .post("/api/snippets/import")
        .attach("file", simpleBuffer, "simple.json")
        .field("conflictResolution", "overwrite")
        .expect(200);

      expect(response.body.imported).toBe(1);
    });

    it("should validate file uploads", async () => {
      // Test missing file
      await request(baseUrl).post("/api/snippets/import").expect(400);

      // Test invalid JSON
      const invalidBuffer = Buffer.from("invalid json content");
      await request(baseUrl)
        .post("/api/snippets/import")
        .attach("file", invalidBuffer, "invalid.json")
        .expect(400);

      // Test invalid format
      const invalidFormat = { notSnippets: "invalid" };
      const invalidFormatBuffer = Buffer.from(JSON.stringify(invalidFormat));
      await request(baseUrl)
        .post("/api/snippets/import")
        .attach("file", invalidFormatBuffer, "invalid-format.json")
        .expect(400);
    });
  });

  describe("Bulk Operations with Error Handling", () => {
    let testSnippetIds: string[];

    beforeEach(async () => {
      // Create test snippets
      const snippets = [
        {
          title: "Bulk Test 1",
          code: 'console.log("bulk1");',
          language: "javascript",
          tags: ["bulk", "test"],
        },
        {
          title: "Bulk Test 2",
          code: 'console.log("bulk2");',
          language: "javascript",
          tags: ["bulk", "test"],
        },
        {
          title: "Bulk Test 3",
          code: 'console.log("bulk3");',
          language: "javascript",
          tags: ["bulk", "test"],
        },
      ];

      testSnippetIds = [];
      for (const snippet of snippets) {
        const created = await mockSnippetManager.createSnippet(snippet);
        testSnippetIds.push(created.id);
      }
    });

    it("should handle partial failures in bulk delete", async () => {
      const mixedIds = [...testSnippetIds, "non-existent-1", "non-existent-2"];

      const response = await request(baseUrl)
        .post("/api/snippets/bulk/delete")
        .send({ ids: mixedIds })
        .expect(200);

      expect(response.body.deleted).toBe(3);
      expect(response.body.failed).toBe(2);
      expect(response.body.errors).toHaveLength(2);
      expect(response.body.errors[0]).toContain("non-existent-1");
      expect(response.body.errors[1]).toContain("non-existent-2");
    });

    it("should handle partial failures in bulk update", async () => {
      const mixedIds = [...testSnippetIds, "non-existent"];

      const response = await request(baseUrl)
        .post("/api/snippets/bulk/update")
        .send({
          ids: mixedIds,
          updates: { tags: ["bulk", "updated"] },
        })
        .expect(200);

      expect(response.body.updated).toBe(3);
      expect(response.body.failed).toBe(1);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0]).toContain("non-existent");
    });

    it("should validate bulk operation parameters", async () => {
      // Test invalid IDs parameter type
      await request(baseUrl)
        .post("/api/snippets/bulk/delete")
        .send({ ids: "not-an-array" })
        .expect(400);

      await request(baseUrl)
        .post("/api/snippets/bulk/update")
        .send({ ids: 123, updates: {} })
        .expect(400);

      // Test missing parameters
      await request(baseUrl)
        .post("/api/snippets/bulk/delete")
        .send({})
        .expect(400);
    });
  });

  describe("Statistics and Analytics", () => {
    beforeEach(async () => {
      // Create comprehensive test data for statistics
      const testData = [
        {
          title: "React Hook",
          code: "const [state, setState] = useState();",
          language: "javascript",
          tags: ["react", "hooks", "frontend"],
          category: "components",
          usageCount: 25,
        },
        {
          title: "Vue Component",
          code: "<template><div>{{ message }}</div></template>",
          language: "javascript",
          tags: ["vue", "component", "frontend"],
          category: "components",
          usageCount: 15,
        },
        {
          title: "Python Function",
          code: "def process_data(data): return data.upper()",
          language: "python",
          tags: ["function", "data", "processing"],
          category: "utilities",
          usageCount: 30,
        },
        {
          title: "SQL Query",
          code: "SELECT * FROM users WHERE active = 1;",
          language: "sql",
          tags: ["query", "database", "select"],
          category: "database",
          usageCount: 12,
        },
        {
          title: "CSS Animation",
          code: "@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }",
          language: "css",
          tags: ["animation", "css", "effects"],
          category: "styling",
          usageCount: 8,
        },
      ];

      for (const snippet of testData) {
        await mockSnippetManager.createSnippet(snippet);
      }
    });

    it("should provide comprehensive statistics", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/stats")
        .expect(200);

      const stats = response.body;

      // Basic counts
      expect(stats.total).toBe(5);
      expect(stats.totalUsage).toBe(90); // 25+15+30+12+8

      // Language distribution
      expect(stats.languages.javascript).toBe(2);
      expect(stats.languages.python).toBe(1);
      expect(stats.languages.sql).toBe(1);
      expect(stats.languages.css).toBe(1);

      // Tag distribution
      expect(stats.tags.frontend).toBe(2);
      expect(stats.tags.react).toBe(1);
      expect(stats.tags.vue).toBe(1);
      expect(stats.tags.function).toBe(1);

      // Category distribution
      expect(stats.categories.components).toBe(2);
      expect(stats.categories.utilities).toBe(1);
      expect(stats.categories.database).toBe(1);
      expect(stats.categories.styling).toBe(1);

      // Most used snippet
      expect(stats.mostUsed).toBeDefined();
      expect(stats.mostUsed.usageCount).toBe(30);
      expect(stats.mostUsed.title).toBe("Python Function");

      // Recent snippets
      expect(stats.recentlyCreated).toHaveLength(5);
      expect(stats.recentlyUpdated).toHaveLength(5);
    });

    it("should handle empty statistics", async () => {
      // Clear all snippets
      mockSnippetManager.clear();

      const response = await request(baseUrl)
        .get("/api/snippets/stats")
        .expect(200);

      const stats = response.body;

      expect(stats.total).toBe(0);
      expect(stats.totalUsage).toBe(0);
      expect(stats.languages).toEqual({});
      expect(stats.tags).toEqual({});
      expect(stats.categories).toEqual({});
      expect(stats.mostUsed).toBeNull();
      expect(stats.recentlyCreated).toHaveLength(0);
      expect(stats.recentlyUpdated).toHaveLength(0);
    });
  });

  describe("Real-time WebSocket Events", () => {
    beforeEach((done) => {
      socketClient = ioClient(baseUrl);
      socketClient.on("connect", () => {
        done();
      });
    });

    it("should emit connection confirmation", (done) => {
      socketClient.on("connected", (data) => {
        expect(data.message).toBe("Connected to snippet library server");
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    it("should emit snippet deletion events", (done) => {
      // First create a snippet
      request(baseUrl)
        .post("/api/snippets")
        .send({
          title: "Delete Test",
          code: 'console.log("delete");',
          language: "javascript",
          tags: ["delete"],
        })
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);

          const snippetId = res.body.id;

          socketClient.on("snippetUpdate", (data) => {
            if (data.action === "deleted") {
              expect(data.snippet.id).toBe(snippetId);
              expect(data.snippet.title).toBe("Delete Test");
              expect(data.timestamp).toBeDefined();
              done();
            }
          });

          // Delete the snippet
          request(baseUrl)
            .delete(`/api/snippets/${snippetId}`)
            .expect(204)
            .end(() => {});
        });
    });

    it("should emit bulk operation events", (done) => {
      socketClient.on("bulkUpdate", (data) => {
        expect(data.action).toBe("deleted");
        expect(data.count).toBe(2);
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Create snippets and then bulk delete
      Promise.all([
        request(baseUrl)
          .post("/api/snippets")
          .send({
            title: "Bulk Delete 1",
            code: 'console.log("bulk1");',
            language: "javascript",
            tags: ["bulk"],
          }),
        request(baseUrl)
          .post("/api/snippets")
          .send({
            title: "Bulk Delete 2",
            code: 'console.log("bulk2");',
            language: "javascript",
            tags: ["bulk"],
          }),
      ]).then((responses) => {
        const ids = responses.map((res) => res.body.id);

        request(baseUrl)
          .post("/api/snippets/bulk/delete")
          .send({ ids })
          .expect(200)
          .end(() => {});
      });
    });

    it("should handle multiple concurrent connections", (done) => {
      const client2 = ioClient(baseUrl);
      let eventsReceived = 0;

      const checkComplete = () => {
        eventsReceived++;
        if (eventsReceived === 2) {
          client2.disconnect();
          done();
        }
      };

      socketClient.on("snippetUpdate", (data) => {
        expect(data.action).toBe("created");
        checkComplete();
      });

      client2.on("snippetUpdate", (data) => {
        expect(data.action).toBe("created");
        checkComplete();
      });

      client2.on("connect", () => {
        // Create a snippet to trigger events
        request(baseUrl)
          .post("/api/snippets")
          .send({
            title: "Multi-client Test",
            code: 'console.log("multi");',
            language: "javascript",
            tags: ["multi"],
          })
          .expect(201)
          .end(() => {});
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle malformed search queries", async () => {
      // Invalid date format
      await request(baseUrl)
        .get("/api/snippets/search?startDate=invalid-date")
        .expect(200); // Should handle gracefully, ignoring invalid dates

      // Empty parameters should not cause errors
      await request(baseUrl)
        .get("/api/snippets/search?tags=&language=")
        .expect(200);
    });

    it("should handle large file uploads", async () => {
      // Create a large import file (within limits)
      const largeSnippets = Array.from({ length: 100 }, (_, i) => ({
        id: `large-${i}`,
        title: `Large Snippet ${i}`,
        code: `console.log("large snippet ${i}");`.repeat(10),
        language: "javascript",
        tags: ["large", "test"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      }));

      const largeImportData = { snippets: largeSnippets };
      const largeBuffer = Buffer.from(JSON.stringify(largeImportData));

      const response = await request(baseUrl)
        .post("/api/snippets/import")
        .attach("file", largeBuffer, "large-import.json")
        .field("conflictResolution", "overwrite")
        .expect(200);

      expect(response.body.imported).toBe(100);
      expect(response.body.errors).toHaveLength(0);
    });

    it("should handle concurrent operations", async () => {
      // Create multiple snippets concurrently
      const createPromises = Array.from({ length: 10 }, (_, i) =>
        request(baseUrl)
          .post("/api/snippets")
          .send({
            title: `Concurrent ${i}`,
            code: `console.log("concurrent ${i}");`,
            language: "javascript",
            tags: ["concurrent"],
          })
      );

      const responses = await Promise.all(createPromises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();
      });

      // Verify all were created
      const listResponse = await request(baseUrl)
        .get("/api/snippets")
        .expect(200);

      expect(listResponse.body).toHaveLength(10);
    });

    it("should handle server resource limits gracefully", async () => {
      // Test with empty bulk operations
      const emptyBulkResponse = await request(baseUrl)
        .post("/api/snippets/bulk/delete")
        .send({ ids: [] })
        .expect(200);

      expect(emptyBulkResponse.body.deleted).toBe(0);
      expect(emptyBulkResponse.body.failed).toBe(0);
    });
  });
});
