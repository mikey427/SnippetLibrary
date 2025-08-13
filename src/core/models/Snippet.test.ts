import { describe, it, expect, beforeEach } from "vitest";
import { Snippet } from "./Snippet";
import { SnippetData } from "../../types";

describe("Snippet", () => {
  let validSnippetData: SnippetData;

  beforeEach(() => {
    validSnippetData = {
      title: "Test Snippet",
      description: "A test snippet for unit testing",
      code: 'console.log("Hello, World!");',
      language: "javascript",
      tags: ["test", "example"],
      category: "testing",
      prefix: "test",
      scope: ["javascript", "typescript"],
    };
  });

  describe("constructor", () => {
    it("should create a snippet with valid data", () => {
      const snippet = new Snippet(validSnippetData);

      expect(snippet.title).toBe(validSnippetData.title);
      expect(snippet.description).toBe(validSnippetData.description);
      expect(snippet.code).toBe(validSnippetData.code);
      expect(snippet.language).toBe(validSnippetData.language);
      expect(snippet.tags).toEqual(validSnippetData.tags);
      expect(snippet.category).toBe(validSnippetData.category);
      expect(snippet.prefix).toBe(validSnippetData.prefix);
      expect(snippet.scope).toEqual(validSnippetData.scope);
      expect(snippet.usageCount).toBe(0);
      expect(snippet.id).toBeDefined();
      expect(snippet.createdAt).toBeInstanceOf(Date);
      expect(snippet.updatedAt).toBeInstanceOf(Date);
    });

    it("should create a snippet with custom id", () => {
      const customId = "custom-id-123";
      const snippet = new Snippet(validSnippetData, customId);

      expect(snippet.id).toBe(customId);
    });

    it("should throw error for invalid data", () => {
      const invalidData = { ...validSnippetData, title: "" };

      expect(() => new Snippet(invalidData)).toThrow("Invalid snippet data");
    });

    it("should handle optional fields", () => {
      const minimalData: SnippetData = {
        title: "Minimal Snippet",
        description: "A minimal snippet",
        code: 'console.log("minimal");',
        language: "javascript",
        tags: [],
      };

      const snippet = new Snippet(minimalData);

      expect(snippet.category).toBeUndefined();
      expect(snippet.prefix).toBeUndefined();
      expect(snippet.scope).toBeUndefined();
    });
  });

  describe("fromExisting", () => {
    it("should create snippet from existing data", () => {
      const existingData = {
        id: "existing-id",
        title: "Existing Snippet",
        description: "An existing snippet",
        code: 'console.log("existing");',
        language: "javascript",
        tags: ["existing"],
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-02"),
        usageCount: 5,
      };

      const snippet = Snippet.fromExisting(existingData);

      expect(snippet.id).toBe(existingData.id);
      expect(snippet.title).toBe(existingData.title);
      expect(snippet.usageCount).toBe(existingData.usageCount);
      expect(snippet.createdAt).toEqual(existingData.createdAt);
      expect(snippet.updatedAt).toEqual(existingData.updatedAt);
    });
  });

  describe("validate", () => {
    it("should return success for valid snippet", () => {
      const snippet = new Snippet(validSnippetData);
      const result = snippet.validate();

      expect(result.success).toBe(true);
    });

    it("should return error for invalid snippet after manual modification", () => {
      const snippet = new Snippet(validSnippetData);
      // Manually corrupt the data (bypassing validation)
      (snippet as any).title = "";

      const result = snippet.validate();

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("validation failed");
    });
  });

  describe("update", () => {
    let snippet: Snippet;

    beforeEach(() => {
      snippet = new Snippet(validSnippetData);
    });

    it("should update snippet with valid data", () => {
      const originalUpdatedAt = snippet.updatedAt;
      const updates = {
        title: "Updated Title",
        description: "Updated description",
        tags: ["updated", "test"],
      };

      const result = snippet.update(updates);

      expect(result.success).toBe(true);
      expect(snippet.title).toBe(updates.title);
      expect(snippet.description).toBe(updates.description);
      expect(snippet.tags).toEqual(updates.tags);
      expect(snippet.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });

    it("should reject invalid updates", () => {
      const invalidUpdates = { title: "" };

      const result = snippet.update(invalidUpdates);

      expect(result.success).toBe(false);
      expect(snippet.title).toBe(validSnippetData.title); // Should remain unchanged
    });

    it("should handle partial updates", () => {
      const originalTitle = snippet.title;
      const updates = { description: "New description only" };

      const result = snippet.update(updates);

      expect(result.success).toBe(true);
      expect(snippet.title).toBe(originalTitle); // Should remain unchanged
      expect(snippet.description).toBe(updates.description);
    });
  });

  describe("incrementUsage", () => {
    it("should increment usage count and update timestamp", () => {
      const snippet = new Snippet(validSnippetData);
      const originalUsageCount = snippet.usageCount;
      const originalUpdatedAt = snippet.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        snippet.incrementUsage();

        expect(snippet.usageCount).toBe(originalUsageCount + 1);
        expect(snippet.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime()
        );
      }, 1);
    });
  });

  describe("toSnippetData", () => {
    it("should convert to SnippetData format", () => {
      const snippet = new Snippet(validSnippetData);
      const snippetData = snippet.toSnippetData();

      expect(snippetData.title).toBe(snippet.title);
      expect(snippetData.description).toBe(snippet.description);
      expect(snippetData.code).toBe(snippet.code);
      expect(snippetData.language).toBe(snippet.language);
      expect(snippetData.tags).toEqual(snippet.tags);
      expect(snippetData.category).toBe(snippet.category);
      expect(snippetData.prefix).toBe(snippet.prefix);
      expect(snippetData.scope).toEqual(snippet.scope);
    });

    it("should create independent arrays for tags and scope", () => {
      const snippet = new Snippet(validSnippetData);
      const snippetData = snippet.toSnippetData();

      // Modify the returned arrays
      snippetData.tags.push("new-tag");
      if (snippetData.scope) {
        snippetData.scope.push("new-scope");
      }

      // Original snippet should be unchanged
      expect(snippet.tags).not.toContain("new-tag");
      expect(snippet.scope).not.toContain("new-scope");
    });
  });

  describe("toJSON", () => {
    it("should convert to JSON format", () => {
      const snippet = new Snippet(validSnippetData);
      const json = snippet.toJSON();

      expect(json.id).toBe(snippet.id);
      expect(json.title).toBe(snippet.title);
      expect(json.createdAt).toEqual(snippet.createdAt);
      expect(json.updatedAt).toEqual(snippet.updatedAt);
      expect(json.usageCount).toBe(snippet.usageCount);
    });
  });

  describe("search methods", () => {
    let snippet: Snippet;

    beforeEach(() => {
      snippet = new Snippet({
        title: "React Component",
        description: "A reusable React component",
        code: "function MyComponent() { return <div>Hello</div>; }",
        language: "javascript",
        tags: ["react", "component", "frontend"],
        category: "components",
      });
    });

    describe("matches", () => {
      it("should match text in title", () => {
        expect(snippet.matches("react")).toBe(true);
        expect(snippet.matches("REACT")).toBe(true); // Case insensitive
      });

      it("should match text in description", () => {
        expect(snippet.matches("reusable")).toBe(true);
      });

      it("should match text in code", () => {
        expect(snippet.matches("MyComponent")).toBe(true);
      });

      it("should match text in language", () => {
        expect(snippet.matches("javascript")).toBe(true);
      });

      it("should match text in tags", () => {
        expect(snippet.matches("frontend")).toBe(true);
      });

      it("should match text in category", () => {
        expect(snippet.matches("components")).toBe(true);
      });

      it("should not match non-existent text", () => {
        expect(snippet.matches("python")).toBe(false);
      });
    });

    describe("hasTags", () => {
      it("should return true if snippet has all specified tags", () => {
        expect(snippet.hasTags(["react"])).toBe(true);
        expect(snippet.hasTags(["react", "component"])).toBe(true);
      });

      it("should return false if snippet is missing any specified tags", () => {
        expect(snippet.hasTags(["react", "vue"])).toBe(false);
      });

      it("should return true for empty tag array", () => {
        expect(snippet.hasTags([])).toBe(true);
      });
    });

    describe("hasCategory", () => {
      it("should return true if snippet has the specified category", () => {
        expect(snippet.hasCategory("components")).toBe(true);
      });

      it("should return false if snippet has different category", () => {
        expect(snippet.hasCategory("utilities")).toBe(false);
      });
    });

    describe("hasLanguage", () => {
      it("should return true if snippet has the specified language", () => {
        expect(snippet.hasLanguage("javascript")).toBe(true);
      });

      it("should return false if snippet has different language", () => {
        expect(snippet.hasLanguage("python")).toBe(false);
      });
    });
  });
});
