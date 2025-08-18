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

// Mock SnippetManager with more realistic behavior
class MockSnippetManager implements SnippetManager {
  private snippets: Map<string, Snippet> = new Map();
  private nextId = 1;

  async createSnippet(snippetData: any): Promise<Snippet> {
    const snippet: Snippet = {
      id: `snippet-${this.nextId++}`,
      title: snippetData.title,
      description: snippetData.description || "",
      code: snippetData.code,
      language: snippetData.language,
      tags: snippetData.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      ...snippetData,
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
      results = results.filter(
        (s) =>
          s.title.toLowerCase().includes(query.text!.toLowerCase()) ||
          s.code.toLowerCase().includes(query.text!.toLowerCase()) ||
          s.description.toLowerCase().includes(query.text!.toLowerCase())
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

    return results;
  }

  async importSnippets(data: ImportData): Promise<any> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const snippet of data.snippets) {
      try {
        if (
          data.conflictResolution === "skip" &&
          this.snippets.has(snippet.id)
        ) {
          skipped++;
        } else {
          this.snippets.set(snippet.id, snippet);
          imported++;
        }
      } catch (error) {
        errors.push(`Failed to import snippet ${snippet.id}: ${error}`);
      }
    }

    return { imported, skipped, errors };
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
}

describe("API Integration Tests", () => {
  let serverManager: WebGUIServerManager;
  let mockSnippetManager: MockSnippetManager;
  let config: ServerManagerConfig;
  let dependencies: WebGUIServerDependencies;
  let baseUrl: string;
  let socketClient: Socket;

  beforeEach(async () => {
    mockSnippetManager = new MockSnippetManager();

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

  describe("Complete Snippet Lifecycle", () => {
    it("should handle full CRUD operations", async () => {
      // Create a snippet
      const snippetData = {
        title: "Test Function",
        description: "A test function",
        code: 'function test() { return "hello"; }',
        language: "javascript",
        tags: ["test", "function"],
      };

      const createResponse = await request(baseUrl)
        .post("/api/snippets")
        .send(snippetData)
        .expect(201);

      const createdSnippet = createResponse.body;
      expect(createdSnippet.id).toBeDefined();
      expect(createdSnippet.title).toBe(snippetData.title);

      // Read the snippet
      const getResponse = await request(baseUrl)
        .get(`/api/snippets/${createdSnippet.id}`)
        .expect(200);

      expect(getResponse.body).toEqual(createdSnippet);

      // Update the snippet
      const updates = { title: "Updated Test Function" };
      const updateResponse = await request(baseUrl)
        .put(`/api/snippets/${createdSnippet.id}`)
        .send(updates)
        .expect(200);

      expect(updateResponse.body.title).toBe(updates.title);
      expect(updateResponse.body.id).toBe(createdSnippet.id);

      // List all snippets
      const listResponse = await request(baseUrl)
        .get("/api/snippets")
        .expect(200);

      expect(listResponse.body).toHaveLength(1);
      expect(listResponse.body[0].title).toBe(updates.title);

      // Delete the snippet
      await request(baseUrl)
        .delete(`/api/snippets/${createdSnippet.id}`)
        .expect(204);

      // Verify deletion
      await request(baseUrl)
        .get(`/api/snippets/${createdSnippet.id}`)
        .expect(404);

      // Verify empty list
      const emptyListResponse = await request(baseUrl)
        .get("/api/snippets")
        .expect(200);

      expect(emptyListResponse.body).toHaveLength(0);
    });
  });

  describe("Search Functionality", () => {
    beforeEach(async () => {
      // Create test snippets
      const snippets = [
        {
          title: "JavaScript Function",
          code: 'function hello() { return "world"; }',
          language: "javascript",
          tags: ["function", "hello"],
        },
        {
          title: "Python Function",
          code: 'def hello(): return "world"',
          language: "python",
          tags: ["function", "hello"],
        },
        {
          title: "CSS Style",
          code: ".hello { color: red; }",
          language: "css",
          tags: ["style", "color"],
        },
      ];

      for (const snippet of snippets) {
        await request(baseUrl).post("/api/snippets").send(snippet).expect(201);
      }
    });

    it("should search by text", async () => {
      const searchQuery = { text: "hello" };

      const response = await request(baseUrl)
        .post("/api/snippets/search")
        .send(searchQuery)
        .expect(200);

      expect(response.body).toHaveLength(3); // All contain "hello"
    });

    it("should search by language", async () => {
      const searchQuery = { language: "javascript" };

      const response = await request(baseUrl)
        .post("/api/snippets/search")
        .send(searchQuery)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].language).toBe("javascript");
    });

    it("should search by tags", async () => {
      const searchQuery = { tags: ["function"] };

      const response = await request(baseUrl)
        .post("/api/snippets/search")
        .send(searchQuery)
        .expect(200);

      expect(response.body).toHaveLength(2); // JavaScript and Python functions
    });

    it("should combine search criteria", async () => {
      const searchQuery = {
        text: "hello",
        language: "python",
        tags: ["function"],
      };

      const response = await request(baseUrl)
        .post("/api/snippets/search")
        .send(searchQuery)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].language).toBe("python");
    });
  });

  describe("Import/Export Workflow", () => {
    it("should export and import snippets", async () => {
      // Create initial snippets
      const snippets = [
        {
          title: "Export Test 1",
          code: 'console.log("test1");',
          language: "javascript",
          tags: ["export"],
        },
        {
          title: "Export Test 2",
          code: 'console.log("test2");',
          language: "javascript",
          tags: ["export"],
        },
      ];

      for (const snippet of snippets) {
        await request(baseUrl).post("/api/snippets").send(snippet).expect(201);
      }

      // Export snippets
      const exportResponse = await request(baseUrl)
        .get("/api/snippets/export")
        .expect(200);

      expect(exportResponse.body.snippets).toHaveLength(2);
      expect(exportResponse.body.format).toBe("json");
      expect(exportResponse.body.exportedAt).toBeDefined();

      // Clear existing snippets
      mockSnippetManager.clear();

      // Import snippets
      const importData: ImportData = {
        snippets: exportResponse.body.snippets,
        format: "json",
        conflictResolution: "overwrite",
      };

      const importResponse = await request(baseUrl)
        .post("/api/snippets/import")
        .send(importData)
        .expect(200);

      expect(importResponse.body.imported).toBe(2);
      expect(importResponse.body.skipped).toBe(0);
      expect(importResponse.body.errors).toHaveLength(0);

      // Verify imported snippets
      const listResponse = await request(baseUrl)
        .get("/api/snippets")
        .expect(200);

      expect(listResponse.body).toHaveLength(2);
    });

    it("should handle import conflicts", async () => {
      // Create a snippet
      const snippet = {
        id: "conflict-test",
        title: "Conflict Test",
        code: 'console.log("original");',
        language: "javascript",
        tags: ["conflict"],
      };

      await mockSnippetManager.createSnippet(snippet);

      // Try to import the same snippet with skip resolution
      const importData: ImportData = {
        snippets: [snippet],
        format: "json",
        conflictResolution: "skip",
      };

      const importResponse = await request(baseUrl)
        .post("/api/snippets/import")
        .send(importData)
        .expect(200);

      expect(importResponse.body.imported).toBe(0);
      expect(importResponse.body.skipped).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed requests gracefully", async () => {
      // Invalid JSON
      await request(baseUrl)
        .post("/api/snippets")
        .set("Content-Type", "application/json")
        .send("invalid json")
        .expect(400);

      // Missing required fields (handled by SnippetManager)
      const response = await request(baseUrl)
        .post("/api/snippets")
        .send({})
        .expect(500); // SnippetManager should throw validation error
    });

    it("should handle non-existent resources", async () => {
      await request(baseUrl).get("/api/snippets/non-existent").expect(404);

      await request(baseUrl)
        .put("/api/snippets/non-existent")
        .send({ title: "Updated" })
        .expect(500); // SnippetManager throws error

      await request(baseUrl).delete("/api/snippets/non-existent").expect(404);
    });
  });

  describe("Enhanced Search Functionality", () => {
    beforeEach(async () => {
      // Create test snippets with more detailed metadata
      const snippets = [
        {
          title: "JavaScript Function",
          code: 'function hello() { return "world"; }',
          language: "javascript",
          tags: ["function", "hello"],
          category: "utilities",
        },
        {
          title: "Python Function",
          code: 'def hello(): return "world"',
          language: "python",
          tags: ["function", "hello"],
          category: "utilities",
        },
        {
          title: "CSS Style",
          code: ".hello { color: red; }",
          language: "css",
          tags: ["style", "color"],
          category: "styling",
        },
      ];

      for (const snippet of snippets) {
        await request(baseUrl).post("/api/snippets").send(snippet).expect(201);
      }
    });

    it("should search via GET with query parameters", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?language=javascript&tags=function")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].language).toBe("javascript");
    });

    it("should search with multiple tags via GET", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?tags=function,hello")
        .expect(200);

      expect(response.body).toHaveLength(2); // JavaScript and Python functions
    });

    it("should filter by category via GET", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?category=utilities")
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it("should support sorting via GET", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/search?sortBy=title&sortOrder=asc")
        .expect(200);

      expect(response.body[0].title).toBe("CSS Style");
      expect(response.body[1].title).toBe("JavaScript Function");
    });
  });

  describe("Enhanced Import/Export with File Handling", () => {
    beforeEach(async () => {
      // Create test snippets
      const snippets = [
        {
          title: "Export Test 1",
          code: 'console.log("test1");',
          language: "javascript",
          tags: ["export", "test"],
          category: "testing",
        },
        {
          title: "Export Test 2",
          code: 'print("test2")',
          language: "python",
          tags: ["export", "test"],
          category: "testing",
        },
      ];

      for (const snippet of snippets) {
        await request(baseUrl).post("/api/snippets").send(snippet).expect(201);
      }
    });

    it("should export with filtering via GET parameters", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/export?languages=javascript&tags=export")
        .expect(200);

      expect(response.body.snippets).toHaveLength(1);
      expect(response.body.snippets[0].language).toBe("javascript");
      expect(response.body.metadata.count).toBe(1);
    });

    it("should export with filtering via POST", async () => {
      const filter = {
        languages: ["python"],
        tags: ["export"],
      };

      const response = await request(baseUrl)
        .post("/api/snippets/export")
        .send(filter)
        .expect(200);

      expect(response.body.snippets).toHaveLength(1);
      expect(response.body.snippets[0].language).toBe("python");
    });

    it("should import via file upload", async () => {
      // First export to get data
      const exportResponse = await request(baseUrl)
        .get("/api/snippets/export")
        .expect(200);

      // Clear existing snippets
      mockSnippetManager.clear();

      // Create a buffer with the export data
      const fileBuffer = Buffer.from(JSON.stringify(exportResponse.body));

      const response = await request(baseUrl)
        .post("/api/snippets/import")
        .attach("file", fileBuffer, "snippets.json")
        .field("conflictResolution", "overwrite")
        .expect(200);

      expect(response.body.imported).toBe(2);
      expect(response.body.skipped).toBe(0);
    });

    it("should handle invalid file uploads", async () => {
      const invalidBuffer = Buffer.from("invalid json content");

      await request(baseUrl)
        .post("/api/snippets/import")
        .attach("file", invalidBuffer, "invalid.json")
        .expect(400);
    });

    it("should import via JSON endpoint", async () => {
      const importData = {
        snippets: [
          {
            id: "json-import-test",
            title: "JSON Import Test",
            code: 'console.log("imported");',
            language: "javascript",
            tags: ["import"],
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
          },
        ],
        conflictResolution: "overwrite",
      };

      const response = await request(baseUrl)
        .post("/api/snippets/import/json")
        .send(importData)
        .expect(200);

      expect(response.body.imported).toBe(1);
    });
  });

  describe("Bulk Operations", () => {
    let snippetIds: string[];

    beforeEach(async () => {
      // Create test snippets
      const snippets = [
        {
          title: "Bulk Test 1",
          code: 'console.log("bulk1");',
          language: "javascript",
          tags: ["bulk"],
        },
        {
          title: "Bulk Test 2",
          code: 'console.log("bulk2");',
          language: "javascript",
          tags: ["bulk"],
        },
        {
          title: "Bulk Test 3",
          code: 'console.log("bulk3");',
          language: "javascript",
          tags: ["bulk"],
        },
      ];

      snippetIds = [];
      for (const snippet of snippets) {
        const response = await request(baseUrl)
          .post("/api/snippets")
          .send(snippet)
          .expect(201);
        snippetIds.push(response.body.id);
      }
    });

    it("should bulk delete snippets", async () => {
      const response = await request(baseUrl)
        .post("/api/snippets/bulk/delete")
        .send({ ids: snippetIds.slice(0, 2) })
        .expect(200);

      expect(response.body.deleted).toBe(2);
      expect(response.body.failed).toBe(0);

      // Verify deletion
      const listResponse = await request(baseUrl)
        .get("/api/snippets")
        .expect(200);

      expect(listResponse.body).toHaveLength(1);
    });

    it("should bulk update snippets", async () => {
      const updates = {
        tags: ["bulk", "updated"],
        category: "bulk-updated",
      };

      const response = await request(baseUrl)
        .post("/api/snippets/bulk/update")
        .send({ ids: snippetIds, updates })
        .expect(200);

      expect(response.body.updated).toBe(3);
      expect(response.body.failed).toBe(0);

      // Verify updates
      for (const id of snippetIds) {
        const getResponse = await request(baseUrl)
          .get(`/api/snippets/${id}`)
          .expect(200);

        expect(getResponse.body.tags).toContain("updated");
        expect(getResponse.body.category).toBe("bulk-updated");
      }
    });

    it("should handle bulk operations with invalid IDs", async () => {
      const response = await request(baseUrl)
        .post("/api/snippets/bulk/delete")
        .send({ ids: [...snippetIds, "invalid-id"] })
        .expect(200);

      expect(response.body.deleted).toBe(3);
      expect(response.body.failed).toBe(1);
      expect(response.body.errors).toHaveLength(1);
    });

    it("should validate bulk operation input", async () => {
      await request(baseUrl)
        .post("/api/snippets/bulk/delete")
        .send({ ids: "not-an-array" })
        .expect(400);
    });
  });

  describe("Statistics Endpoint", () => {
    beforeEach(async () => {
      // Create diverse test snippets
      const snippets = [
        {
          title: "JS Function 1",
          code: "function test1() {}",
          language: "javascript",
          tags: ["function", "test"],
          category: "utilities",
          usageCount: 5,
        },
        {
          title: "JS Function 2",
          code: "function test2() {}",
          language: "javascript",
          tags: ["function", "helper"],
          category: "utilities",
          usageCount: 10,
        },
        {
          title: "Python Script",
          code: "def test(): pass",
          language: "python",
          tags: ["function", "script"],
          category: "scripts",
          usageCount: 3,
        },
        {
          title: "CSS Rule",
          code: ".test { color: red; }",
          language: "css",
          tags: ["style"],
          category: "styling",
          usageCount: 1,
        },
      ];

      for (const snippet of snippets) {
        await mockSnippetManager.createSnippet(snippet);
      }
    });

    it("should provide comprehensive statistics", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets/stats")
        .expect(200);

      const stats = response.body;

      expect(stats.total).toBe(4);
      expect(stats.languages.javascript).toBe(2);
      expect(stats.languages.python).toBe(1);
      expect(stats.languages.css).toBe(1);

      expect(stats.tags.function).toBe(3);
      expect(stats.tags.test).toBe(1);
      expect(stats.tags.helper).toBe(1);

      expect(stats.categories.utilities).toBe(2);
      expect(stats.categories.scripts).toBe(1);
      expect(stats.categories.styling).toBe(1);

      expect(stats.totalUsage).toBe(19);
      expect(stats.mostUsed).toBeDefined();
      expect(stats.mostUsed.usageCount).toBe(10);

      expect(stats.recentlyCreated).toHaveLength(4);
      expect(stats.recentlyUpdated).toHaveLength(4);
    });
  });

  describe("Real-time Updates via WebSocket", () => {
    beforeEach((done) => {
      socketClient = ioClient(baseUrl);
      socketClient.on("connect", () => {
        done();
      });
    });

    it("should emit snippet creation events", (done) => {
      socketClient.on("snippetUpdate", (data) => {
        expect(data.action).toBe("created");
        expect(data.snippet.title).toBe("WebSocket Test");
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Create a snippet to trigger the event
      request(baseUrl)
        .post("/api/snippets")
        .send({
          title: "WebSocket Test",
          code: 'console.log("websocket");',
          language: "javascript",
          tags: ["websocket"],
        })
        .expect(201)
        .end(() => {});
    });

    it("should emit snippet update events", (done) => {
      // First create a snippet
      request(baseUrl)
        .post("/api/snippets")
        .send({
          title: "Update Test",
          code: 'console.log("original");',
          language: "javascript",
          tags: ["update"],
        })
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);

          const snippetId = res.body.id;

          socketClient.on("snippetUpdate", (data) => {
            if (data.action === "updated") {
              expect(data.snippet.title).toBe("Updated Test");
              expect(data.snippet.id).toBe(snippetId);
              done();
            }
          });

          // Update the snippet
          request(baseUrl)
            .put(`/api/snippets/${snippetId}`)
            .send({ title: "Updated Test" })
            .expect(200)
            .end(() => {});
        });
    });

    it("should emit bulk operation events", (done) => {
      socketClient.on("bulkUpdate", (data) => {
        expect(data.action).toBe("imported");
        expect(data.count).toBe(2);
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Perform bulk import
      const importData = {
        snippets: [
          {
            id: "bulk1",
            title: "Bulk 1",
            code: 'console.log("bulk1");',
            language: "javascript",
            tags: ["bulk"],
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
          },
          {
            id: "bulk2",
            title: "Bulk 2",
            code: 'console.log("bulk2");',
            language: "javascript",
            tags: ["bulk"],
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
          },
        ],
        conflictResolution: "overwrite",
      };

      request(baseUrl)
        .post("/api/snippets/import/json")
        .send(importData)
        .expect(200)
        .end(() => {});
    });
  });

  describe("Enhanced Query Parameter Support", () => {
    beforeEach(async () => {
      const snippets = [
        {
          title: "Query Test 1",
          code: "function query1() {}",
          language: "javascript",
          tags: ["query", "test"],
          category: "testing",
        },
        {
          title: "Query Test 2",
          code: "function query2() {}",
          language: "typescript",
          tags: ["query", "advanced"],
          category: "testing",
        },
      ];

      for (const snippet of snippets) {
        await request(baseUrl).post("/api/snippets").send(snippet).expect(201);
      }
    });

    it("should support filtering in GET /api/snippets", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets?language=javascript&tags=query")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].language).toBe("javascript");
    });

    it("should support sorting in GET /api/snippets", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets?sortBy=title&sortOrder=desc")
        .expect(200);

      expect(response.body[0].title).toBe("Query Test 2");
      expect(response.body[1].title).toBe("Query Test 1");
    });

    it("should support category filtering", async () => {
      const response = await request(baseUrl)
        .get("/api/snippets?category=testing")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((s: any) => s.category === "testing")).toBe(
        true
      );
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle malformed requests gracefully", async () => {
      // Invalid JSON
      await request(baseUrl)
        .post("/api/snippets")
        .set("Content-Type", "application/json")
        .send("invalid json")
        .expect(400);

      // Missing required fields (handled by SnippetManager)
      const response = await request(baseUrl)
        .post("/api/snippets")
        .send({})
        .expect(500); // SnippetManager should throw validation error
    });

    it("should handle non-existent resources", async () => {
      await request(baseUrl).get("/api/snippets/non-existent").expect(404);

      await request(baseUrl)
        .put("/api/snippets/non-existent")
        .send({ title: "Updated" })
        .expect(500); // SnippetManager throws error

      await request(baseUrl).delete("/api/snippets/non-existent").expect(404);
    });

    it("should handle file upload errors", async () => {
      // No file uploaded
      await request(baseUrl).post("/api/snippets/import").expect(400);

      // Invalid file type (if we had file type validation)
      const textBuffer = Buffer.from("plain text");
      await request(baseUrl)
        .post("/api/snippets/import")
        .attach("file", textBuffer, "invalid.txt")
        .expect(400);
    });

    it("should validate bulk operation parameters", async () => {
      // Invalid IDs parameter
      await request(baseUrl)
        .post("/api/snippets/bulk/delete")
        .send({ ids: "not-an-array" })
        .expect(400);

      await request(baseUrl)
        .post("/api/snippets/bulk/update")
        .send({ ids: "not-an-array", updates: {} })
        .expect(400);
    });
  });

  describe("Server Health", () => {
    it("should provide health check endpoint", async () => {
      const response = await request(baseUrl).get("/health").expect(200);

      expect(response.body.status).toBe("ok");
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
