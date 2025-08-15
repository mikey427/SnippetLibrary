import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import {
  WebGUIServerManager,
  ServerManagerConfig,
} from "../WebGUIServerManager";
import { WebGUIServerDependencies } from "../WebGUIServer";
import { SnippetManager } from "../../../interfaces/SnippetManager";
import { Snippet, SearchQuery, ImportData, ExportData } from "../../../types";

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

  async exportSnippets(filter?: any): Promise<ExportData> {
    let snippets = Array.from(this.snippets.values());

    if (filter?.language) {
      snippets = snippets.filter((s) => s.language === filter.language);
    }

    return {
      snippets,
      format: "json",
      exportedAt: new Date(),
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

  describe("Server Health", () => {
    it("should provide health check endpoint", async () => {
      const response = await request(baseUrl).get("/health").expect(200);

      expect(response.body.status).toBe("ok");
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
