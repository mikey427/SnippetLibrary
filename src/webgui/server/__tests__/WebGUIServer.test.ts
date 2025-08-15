import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import {
  WebGUIServer,
  WebGUIServerConfig,
  WebGUIServerDependencies,
} from "../WebGUIServer";
import { SnippetManager } from "../../../interfaces/SnippetManager";
import { Snippet, SearchQuery, ImportData, ExportData } from "../../../types";

// Mock SnippetManager
const mockSnippetManager: SnippetManager = {
  createSnippet: vi.fn(),
  getSnippet: vi.fn(),
  updateSnippet: vi.fn(),
  deleteSnippet: vi.fn(),
  searchSnippets: vi.fn(),
  importSnippets: vi.fn(),
  exportSnippets: vi.fn(),
};

describe("WebGUIServer", () => {
  let server: WebGUIServer;
  let config: WebGUIServerConfig;
  let dependencies: WebGUIServerDependencies;

  const mockSnippet: Snippet = {
    id: "test-id",
    title: "Test Snippet",
    description: "A test snippet",
    code: 'console.log("test");',
    language: "javascript",
    tags: ["test"],
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 0,
  };

  beforeEach(() => {
    config = {
      port: 0, // Use random port for testing
      host: "localhost",
      corsOrigins: ["http://localhost:3000"],
    };

    dependencies = {
      snippetManager: mockSnippetManager,
    };

    server = new WebGUIServer(config, dependencies);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (server.isRunning()) {
      await server.stop();
    }
  });

  describe("Server Lifecycle", () => {
    it("should start and stop server successfully", async () => {
      expect(server.isRunning()).toBe(false);

      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it("should not allow starting server twice", async () => {
      await server.start();

      await expect(server.start()).rejects.toThrow("Server is already running");

      await server.stop();
    });

    it("should restart server successfully", async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.restart();
      expect(server.isRunning()).toBe(true);

      await server.stop();
    });
  });

  describe("Health Check Endpoint", () => {
    beforeEach(async () => {
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it("should return health status", async () => {
      const response = await request(server.getApp())
        .get("/health")
        .expect(200);

      expect(response.body).toEqual({
        status: "ok",
        timestamp: expect.any(String),
      });
    });
  });

  describe("Snippet CRUD Endpoints", () => {
    beforeEach(async () => {
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    describe("GET /api/snippets", () => {
      it("should return all snippets", async () => {
        const mockSnippets = [mockSnippet];
        vi.mocked(mockSnippetManager.searchSnippets).mockResolvedValue(
          mockSnippets
        );

        const response = await request(server.getApp())
          .get("/api/snippets")
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          id: mockSnippet.id,
          title: mockSnippet.title,
          description: mockSnippet.description,
          code: mockSnippet.code,
          language: mockSnippet.language,
          tags: mockSnippet.tags,
          usageCount: mockSnippet.usageCount,
        });
        expect(mockSnippetManager.searchSnippets).toHaveBeenCalledWith({});
      });

      it("should handle errors when fetching snippets", async () => {
        vi.mocked(mockSnippetManager.searchSnippets).mockRejectedValue(
          new Error("Database error")
        );

        await request(server.getApp()).get("/api/snippets").expect(500);
      });
    });

    describe("POST /api/snippets", () => {
      it("should create a new snippet", async () => {
        const snippetData = {
          title: "New Snippet",
          description: "A new snippet",
          code: 'console.log("new");',
          language: "javascript",
          tags: ["new"],
        };

        vi.mocked(mockSnippetManager.createSnippet).mockResolvedValue(
          mockSnippet
        );

        const response = await request(server.getApp())
          .post("/api/snippets")
          .send(snippetData)
          .expect(201);

        expect(response.body).toMatchObject({
          id: mockSnippet.id,
          title: mockSnippet.title,
          description: mockSnippet.description,
          code: mockSnippet.code,
          language: mockSnippet.language,
          tags: mockSnippet.tags,
          usageCount: mockSnippet.usageCount,
        });
        expect(mockSnippetManager.createSnippet).toHaveBeenCalledWith(
          snippetData
        );
      });

      it("should handle creation errors", async () => {
        vi.mocked(mockSnippetManager.createSnippet).mockRejectedValue(
          new Error("Validation error")
        );

        await request(server.getApp())
          .post("/api/snippets")
          .send({})
          .expect(500);
      });
    });

    describe("GET /api/snippets/:id", () => {
      it("should return a specific snippet", async () => {
        vi.mocked(mockSnippetManager.getSnippet).mockResolvedValue(mockSnippet);

        const response = await request(server.getApp())
          .get("/api/snippets/test-id")
          .expect(200);

        expect(response.body).toMatchObject({
          id: mockSnippet.id,
          title: mockSnippet.title,
          description: mockSnippet.description,
          code: mockSnippet.code,
          language: mockSnippet.language,
          tags: mockSnippet.tags,
          usageCount: mockSnippet.usageCount,
        });
        expect(mockSnippetManager.getSnippet).toHaveBeenCalledWith("test-id");
      });

      it("should return 404 for non-existent snippet", async () => {
        vi.mocked(mockSnippetManager.getSnippet).mockResolvedValue(null);

        const response = await request(server.getApp())
          .get("/api/snippets/non-existent")
          .expect(404);

        expect(response.body).toEqual({ error: "Snippet not found" });
      });
    });

    describe("PUT /api/snippets/:id", () => {
      it("should update a snippet", async () => {
        const updates = { title: "Updated Title" };
        const updatedSnippet = { ...mockSnippet, ...updates };

        vi.mocked(mockSnippetManager.updateSnippet).mockResolvedValue(
          updatedSnippet
        );

        const response = await request(server.getApp())
          .put("/api/snippets/test-id")
          .send(updates)
          .expect(200);

        expect(response.body).toMatchObject({
          id: updatedSnippet.id,
          title: updatedSnippet.title,
          description: updatedSnippet.description,
          code: updatedSnippet.code,
          language: updatedSnippet.language,
          tags: updatedSnippet.tags,
          usageCount: updatedSnippet.usageCount,
        });
        expect(mockSnippetManager.updateSnippet).toHaveBeenCalledWith(
          "test-id",
          updates
        );
      });

      it("should handle update errors", async () => {
        vi.mocked(mockSnippetManager.updateSnippet).mockRejectedValue(
          new Error("Update failed")
        );

        await request(server.getApp())
          .put("/api/snippets/test-id")
          .send({ title: "New Title" })
          .expect(500);
      });
    });

    describe("DELETE /api/snippets/:id", () => {
      it("should delete a snippet", async () => {
        vi.mocked(mockSnippetManager.deleteSnippet).mockResolvedValue(true);

        await request(server.getApp())
          .delete("/api/snippets/test-id")
          .expect(204);

        expect(mockSnippetManager.deleteSnippet).toHaveBeenCalledWith(
          "test-id"
        );
      });

      it("should return 404 for non-existent snippet", async () => {
        vi.mocked(mockSnippetManager.deleteSnippet).mockResolvedValue(false);

        const response = await request(server.getApp())
          .delete("/api/snippets/non-existent")
          .expect(404);

        expect(response.body).toEqual({ error: "Snippet not found" });
      });
    });
  });

  describe("Search Endpoint", () => {
    beforeEach(async () => {
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it("should search snippets with query", async () => {
      const searchQuery: SearchQuery = {
        text: "test",
        language: "javascript",
        tags: ["test"],
      };
      const searchResults = [mockSnippet];

      vi.mocked(mockSnippetManager.searchSnippets).mockResolvedValue(
        searchResults
      );

      const response = await request(server.getApp())
        .post("/api/snippets/search")
        .send(searchQuery)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: mockSnippet.id,
        title: mockSnippet.title,
        description: mockSnippet.description,
        code: mockSnippet.code,
        language: mockSnippet.language,
        tags: mockSnippet.tags,
        usageCount: mockSnippet.usageCount,
      });
      expect(mockSnippetManager.searchSnippets).toHaveBeenCalledWith(
        searchQuery
      );
    });

    it("should handle search errors", async () => {
      vi.mocked(mockSnippetManager.searchSnippets).mockRejectedValue(
        new Error("Search failed")
      );

      await request(server.getApp())
        .post("/api/snippets/search")
        .send({ text: "test" })
        .expect(500);
    });
  });

  describe("Import/Export Endpoints", () => {
    beforeEach(async () => {
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    describe("POST /api/snippets/import", () => {
      it("should import snippets", async () => {
        const importData: ImportData = {
          snippets: [mockSnippet],
          format: "json",
          conflictResolution: "skip",
        };
        const importResult = {
          imported: 1,
          skipped: 0,
          errors: [],
        };

        vi.mocked(mockSnippetManager.importSnippets).mockResolvedValue(
          importResult
        );

        const response = await request(server.getApp())
          .post("/api/snippets/import")
          .send(importData)
          .expect(200);

        expect(response.body).toEqual(importResult);
        expect(mockSnippetManager.importSnippets).toHaveBeenCalledWith(
          expect.objectContaining({
            format: importData.format,
            conflictResolution: importData.conflictResolution,
            snippets: expect.arrayContaining([
              expect.objectContaining({
                id: mockSnippet.id,
                title: mockSnippet.title,
                code: mockSnippet.code,
                language: mockSnippet.language,
              }),
            ]),
          })
        );
      });

      it("should handle import errors", async () => {
        vi.mocked(mockSnippetManager.importSnippets).mockRejectedValue(
          new Error("Import failed")
        );

        await request(server.getApp())
          .post("/api/snippets/import")
          .send({ snippets: [] })
          .expect(500);
      });
    });

    describe("GET /api/snippets/export", () => {
      it("should export snippets", async () => {
        const exportData: ExportData = {
          snippets: [mockSnippet],
          format: "json",
          exportedAt: new Date(),
        };

        vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue(
          exportData
        );

        const response = await request(server.getApp())
          .get("/api/snippets/export")
          .expect(200);

        expect(response.body).toMatchObject({
          format: exportData.format,
          snippets: expect.any(Array),
        });
        expect(response.headers["content-type"]).toContain("application/json");
        expect(response.headers["content-disposition"]).toContain(
          'attachment; filename="snippets-export.json"'
        );
      });

      it("should export snippets with filter", async () => {
        const filter = { language: "javascript" };
        const exportData: ExportData = {
          snippets: [mockSnippet],
          format: "json",
          exportedAt: new Date(),
        };

        vi.mocked(mockSnippetManager.exportSnippets).mockResolvedValue(
          exportData
        );

        await request(server.getApp())
          .get("/api/snippets/export")
          .query(filter)
          .expect(200);

        expect(mockSnippetManager.exportSnippets).toHaveBeenCalledWith(filter);
      });
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it("should return 404 for unknown routes", async () => {
      const response = await request(server.getApp())
        .get("/api/unknown")
        .expect(404);

      expect(response.body).toEqual({
        error: "Not Found",
        message: "Route GET /api/unknown not found",
      });
    });

    it("should handle malformed JSON", async () => {
      await request(server.getApp())
        .post("/api/snippets")
        .set("Content-Type", "application/json")
        .send("invalid json")
        .expect(500); // Express error middleware catches JSON parsing errors
    });
  });

  describe("CORS Configuration", () => {
    beforeEach(async () => {
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it("should include CORS headers", async () => {
      const response = await request(server.getApp())
        .options("/api/snippets")
        .set("Origin", "http://localhost:3000")
        .expect(204);

      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000"
      );
    });
  });
});
