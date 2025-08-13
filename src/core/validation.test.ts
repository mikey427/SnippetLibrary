import { describe, it, expect, beforeEach } from "vitest";
import { validateSnippetData, validateSearchQuery } from "./validation";
import { SnippetData, SearchQuery } from "../types";

describe("validation", () => {
  describe("validateSnippetData", () => {
    let validSnippetData: SnippetData;

    beforeEach(() => {
      validSnippetData = {
        title: "Test Snippet",
        description: "A test snippet",
        code: 'console.log("test");',
        language: "javascript",
        tags: ["test", "example"],
        category: "testing",
        prefix: "test",
        scope: ["javascript"],
      };
    });

    it("should return success for valid snippet data", () => {
      const result = validateSnippetData(validSnippetData);

      expect(result.success).toBe(true);
    });

    describe("title validation", () => {
      it("should reject empty title", () => {
        const data = { ...validSnippetData, title: "" };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain("validation failed");
        expect(result.error?.details.errors).toContain("Title is required");
      });

      it("should reject title longer than 100 characters", () => {
        const data = { ...validSnippetData, title: "a".repeat(101) };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Title must be 100 characters or less"
        );
      });
    });

    describe("description validation", () => {
      it("should accept empty description", () => {
        const data = { ...validSnippetData, description: "" };
        const result = validateSnippetData(data);

        expect(result.success).toBe(true);
      });

      it("should reject description longer than 500 characters", () => {
        const data = { ...validSnippetData, description: "a".repeat(501) };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Description must be 500 characters or less"
        );
      });
    });

    describe("code validation", () => {
      it("should reject empty code", () => {
        const data = { ...validSnippetData, code: "" };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain("Code is required");
      });

      it("should reject code longer than 50,000 characters", () => {
        const data = { ...validSnippetData, code: "a".repeat(50001) };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Code must be 50,000 characters or less"
        );
      });
    });

    describe("language validation", () => {
      it("should reject empty language", () => {
        const data = { ...validSnippetData, language: "" };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain("Language is required");
      });

      it("should reject language with invalid characters", () => {
        const data = { ...validSnippetData, language: "java script!" };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Language must contain only alphanumeric characters, hyphens, and underscores"
        );
      });

      it("should accept valid language names", () => {
        const validLanguages = [
          "javascript",
          "python",
          "c-sharp",
          "type_script",
        ];

        for (const language of validLanguages) {
          const data = { ...validSnippetData, language };
          const result = validateSnippetData(data);
          expect(result.success).toBe(true);
        }
      });
    });

    describe("tags validation", () => {
      it("should reject non-array tags", () => {
        const data = { ...validSnippetData, tags: "not-array" as any };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain("Tags must be an array");
      });

      it("should reject more than 20 tags", () => {
        const data = { ...validSnippetData, tags: Array(21).fill("tag") };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Maximum 20 tags allowed"
        );
      });

      it("should reject empty tag strings", () => {
        const data = { ...validSnippetData, tags: ["valid", ""] };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "All tags must be non-empty strings"
        );
      });

      it("should reject tags longer than 50 characters", () => {
        const data = { ...validSnippetData, tags: ["valid", "a".repeat(51)] };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Each tag must be 50 characters or less"
        );
      });

      it("should accept empty tags array", () => {
        const data = { ...validSnippetData, tags: [] };
        const result = validateSnippetData(data);

        expect(result.success).toBe(true);
      });
    });

    describe("category validation", () => {
      it("should accept undefined category", () => {
        const data = { ...validSnippetData, category: undefined };
        const result = validateSnippetData(data);

        expect(result.success).toBe(true);
      });

      it("should reject category longer than 100 characters", () => {
        const data = { ...validSnippetData, category: "a".repeat(101) };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Category must be 100 characters or less"
        );
      });
    });

    describe("prefix validation", () => {
      it("should accept undefined prefix", () => {
        const data = { ...validSnippetData, prefix: undefined };
        const result = validateSnippetData(data);

        expect(result.success).toBe(true);
      });

      it("should reject prefix longer than 50 characters", () => {
        const data = { ...validSnippetData, prefix: "a".repeat(51) };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Prefix must be 50 characters or less"
        );
      });

      it("should reject prefix with invalid characters", () => {
        const data = { ...validSnippetData, prefix: "test prefix!" };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Prefix must contain only alphanumeric characters, hyphens, and underscores"
        );
      });
    });

    describe("scope validation", () => {
      it("should accept undefined scope", () => {
        const data = { ...validSnippetData, scope: undefined };
        const result = validateSnippetData(data);

        expect(result.success).toBe(true);
      });

      it("should reject non-array scope", () => {
        const data = { ...validSnippetData, scope: "not-array" as any };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Scope must be an array"
        );
      });

      it("should reject more than 10 scope entries", () => {
        const data = { ...validSnippetData, scope: Array(11).fill("scope") };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "Maximum 10 scope entries allowed"
        );
      });

      it("should reject empty scope strings", () => {
        const data = { ...validSnippetData, scope: ["valid", ""] };
        const result = validateSnippetData(data);

        expect(result.success).toBe(false);
        expect(result.error?.details.errors).toContain(
          "All scope entries must be non-empty strings"
        );
      });
    });
  });

  describe("validateSearchQuery", () => {
    it("should return success for valid empty query", () => {
      const result = validateSearchQuery({});

      expect(result.success).toBe(true);
    });

    it("should return success for valid query with all fields", () => {
      const query: SearchQuery = {
        text: "test",
        language: "javascript",
        tags: ["react", "component"],
        category: "frontend",
        dateRange: {
          start: new Date("2023-01-01"),
          end: new Date("2023-12-31"),
        },
        sortBy: "title",
        sortOrder: "asc",
      };

      const result = validateSearchQuery(query);

      expect(result.success).toBe(true);
    });

    it("should reject non-object query", () => {
      const result = validateSearchQuery("invalid");

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Search query must be an object");
    });

    it("should reject non-string text", () => {
      const result = validateSearchQuery({ text: 123 });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Search text must be a string");
    });

    it("should reject non-string language", () => {
      const result = validateSearchQuery({ language: 123 });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(
        "Language filter must be a string"
      );
    });

    it("should reject non-array tags", () => {
      const result = validateSearchQuery({ tags: "not-array" });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Tags filter must be an array");
    });

    it("should reject invalid sortBy field", () => {
      const result = validateSearchQuery({ sortBy: "invalid" });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(
        "Sort field must be one of: title, createdAt, usageCount"
      );
    });

    it("should reject invalid sortOrder", () => {
      const result = validateSearchQuery({ sortOrder: "invalid" });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(
        "Sort order must be one of: asc, desc"
      );
    });

    it("should accept valid sortBy fields", () => {
      const validSortFields = ["title", "createdAt", "usageCount"];

      for (const sortBy of validSortFields) {
        const result = validateSearchQuery({ sortBy });
        expect(result.success).toBe(true);
      }
    });

    it("should accept valid sortOrder values", () => {
      const validSortOrders = ["asc", "desc"];

      for (const sortOrder of validSortOrders) {
        const result = validateSearchQuery({ sortOrder });
        expect(result.success).toBe(true);
      }
    });
  });
});
