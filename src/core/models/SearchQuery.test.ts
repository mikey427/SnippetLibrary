import { describe, it, expect, beforeEach } from "vitest";
import { SearchQuery } from "./SearchQuery";
import { SearchQuery as ISearchQuery } from "../../types";

describe("SearchQuery", () => {
  describe("constructor", () => {
    it("should create empty query with no parameters", () => {
      const query = new SearchQuery();

      expect(query.text).toBeUndefined();
      expect(query.language).toBeUndefined();
      expect(query.tags).toBeUndefined();
      expect(query.category).toBeUndefined();
      expect(query.dateRange).toBeUndefined();
      expect(query.sortBy).toBeUndefined();
      expect(query.sortOrder).toBeUndefined();
    });

    it("should create query with provided parameters", () => {
      const queryData: ISearchQuery = {
        text: "test",
        language: "javascript",
        tags: ["react", "component"],
        category: "frontend",
        sortBy: "title",
        sortOrder: "asc",
      };

      const query = new SearchQuery(queryData);

      expect(query.text).toBe(queryData.text);
      expect(query.language).toBe(queryData.language);
      expect(query.tags).toEqual(queryData.tags);
      expect(query.category).toBe(queryData.category);
      expect(query.sortBy).toBe(queryData.sortBy);
      expect(query.sortOrder).toBe(queryData.sortOrder);
    });

    it("should create query with date range", () => {
      const start = new Date("2023-01-01");
      const end = new Date("2023-12-31");
      const queryData: ISearchQuery = {
        dateRange: { start, end },
      };

      const query = new SearchQuery(queryData);

      expect(query.dateRange?.start).toEqual(start);
      expect(query.dateRange?.end).toEqual(end);
    });

    it("should throw error for invalid query", () => {
      const invalidQuery = { sortBy: "invalid" };

      expect(() => new SearchQuery(invalidQuery)).toThrow(
        "Invalid search query"
      );
    });

    it("should create independent arrays for tags", () => {
      const originalTags = ["react", "component"];
      const query = new SearchQuery({ tags: originalTags });

      // Modify the original array
      originalTags.push("new-tag");

      // Query should be unchanged
      expect(query.tags).not.toContain("new-tag");
    });
  });

  describe("static factory methods", () => {
    it("should create query with text using withText", () => {
      const query = SearchQuery.withText("test search");

      expect(query.text).toBe("test search");
      expect(query.language).toBeUndefined();
    });

    it("should create query with language using withLanguage", () => {
      const query = SearchQuery.withLanguage("javascript");

      expect(query.language).toBe("javascript");
      expect(query.text).toBeUndefined();
    });

    it("should create query with tags using withTags", () => {
      const tags = ["react", "component"];
      const query = SearchQuery.withTags(tags);

      expect(query.tags).toEqual(tags);
      expect(query.text).toBeUndefined();
    });

    it("should create query with category using withCategory", () => {
      const query = SearchQuery.withCategory("frontend");

      expect(query.category).toBe("frontend");
      expect(query.text).toBeUndefined();
    });

    it("should create query with date range using withDateRange", () => {
      const start = new Date("2023-01-01");
      const end = new Date("2023-12-31");
      const query = SearchQuery.withDateRange(start, end);

      expect(query.dateRange?.start).toEqual(start);
      expect(query.dateRange?.end).toEqual(end);
    });
  });

  describe("validate", () => {
    it("should return success for valid query", () => {
      const query = new SearchQuery({
        text: "test",
        language: "javascript",
        sortBy: "title",
        sortOrder: "asc",
      });

      const result = query.validate();

      expect(result.success).toBe(true);
    });

    it("should return error for invalid query after manual modification", () => {
      const query = new SearchQuery();
      // Manually corrupt the data
      (query as any).sortBy = "invalid";

      const result = query.validate();

      expect(result.success).toBe(false);
    });
  });

  describe("builder methods", () => {
    let query: SearchQuery;

    beforeEach(() => {
      query = new SearchQuery();
    });

    describe("addText", () => {
      it("should add text filter", () => {
        const result = query.addText("test search");

        expect(result.success).toBe(true);
        expect(result.data?.text).toBe("test search");
      });

      it("should return error for invalid text", () => {
        const result = query.addText(123 as any);

        expect(result.success).toBe(false);
      });
    });

    describe("addLanguage", () => {
      it("should add language filter", () => {
        const result = query.addLanguage("javascript");

        expect(result.success).toBe(true);
        expect(result.data?.language).toBe("javascript");
      });

      it("should return error for invalid language", () => {
        const result = query.addLanguage(123 as any);

        expect(result.success).toBe(false);
      });
    });

    describe("addTags", () => {
      it("should add tags filter", () => {
        const tags = ["react", "component"];
        const result = query.addTags(tags);

        expect(result.success).toBe(true);
        expect(result.data?.tags).toEqual(tags);
      });

      it("should create independent array", () => {
        const tags = ["react", "component"];
        const result = query.addTags(tags);

        // Modify original array
        tags.push("new-tag");

        // Query should be unchanged
        expect(result.data?.tags).not.toContain("new-tag");
      });
    });

    describe("addCategory", () => {
      it("should add category filter", () => {
        const result = query.addCategory("frontend");

        expect(result.success).toBe(true);
        expect(result.data?.category).toBe("frontend");
      });
    });

    describe("addDateRange", () => {
      it("should add date range filter", () => {
        const start = new Date("2023-01-01");
        const end = new Date("2023-12-31");
        const result = query.addDateRange(start, end);

        expect(result.success).toBe(true);
        expect(result.data?.dateRange?.start).toEqual(start);
        expect(result.data?.dateRange?.end).toEqual(end);
      });

      it("should return error if start date is after end date", () => {
        const start = new Date("2023-12-31");
        const end = new Date("2023-01-01");
        const result = query.addDateRange(start, end);

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain(
          "Start date must be before end date"
        );
      });
    });

    describe("setSorting", () => {
      it("should set sorting with default order", () => {
        const result = query.setSorting("title");

        expect(result.success).toBe(true);
        expect(result.data?.sortBy).toBe("title");
        expect(result.data?.sortOrder).toBe("asc");
      });

      it("should set sorting with specified order", () => {
        const result = query.setSorting("usageCount", "desc");

        expect(result.success).toBe(true);
        expect(result.data?.sortBy).toBe("usageCount");
        expect(result.data?.sortOrder).toBe("desc");
      });

      it("should return error for invalid sort field", () => {
        const result = query.setSorting("invalid" as any);

        expect(result.success).toBe(false);
      });
    });
  });

  describe("utility methods", () => {
    describe("clear", () => {
      it("should return empty query", () => {
        const query = new SearchQuery({
          text: "test",
          language: "javascript",
          tags: ["react"],
        });

        const cleared = query.clear();

        expect(cleared.isEmpty()).toBe(true);
      });
    });

    describe("isEmpty", () => {
      it("should return true for empty query", () => {
        const query = new SearchQuery();

        expect(query.isEmpty()).toBe(true);
      });

      it("should return false for query with filters", () => {
        const query = new SearchQuery({ text: "test" });

        expect(query.isEmpty()).toBe(false);
      });

      it("should return true for query with empty tags array", () => {
        const query = new SearchQuery({ tags: [] });

        expect(query.isEmpty()).toBe(true);
      });
    });

    describe("hasFilters", () => {
      it("should return false for empty query", () => {
        const query = new SearchQuery();

        expect(query.hasFilters()).toBe(false);
      });

      it("should return true for query with filters", () => {
        const query = new SearchQuery({ text: "test" });

        expect(query.hasFilters()).toBe(true);
      });
    });

    describe("getFilterSummary", () => {
      it("should return empty array for empty query", () => {
        const query = new SearchQuery();

        expect(query.getFilterSummary()).toEqual([]);
      });

      it("should return summary of active filters", () => {
        const query = new SearchQuery({
          text: "test",
          language: "javascript",
          tags: ["react", "component"],
          category: "frontend",
          sortBy: "title",
          sortOrder: "desc",
        });

        const summary = query.getFilterSummary();

        expect(summary).toContain('text: "test"');
        expect(summary).toContain("language: javascript");
        expect(summary).toContain("tags: [react, component]");
        expect(summary).toContain("category: frontend");
        expect(summary).toContain("sort: title desc");
      });

      it("should include date range in summary", () => {
        const start = new Date("2023-01-01");
        const end = new Date("2023-12-31");
        const query = new SearchQuery({
          dateRange: { start, end },
        });

        const summary = query.getFilterSummary();

        expect(summary[0]).toContain("date range:");
        expect(summary[0]).toContain("2023");
      });
    });

    describe("clone", () => {
      it("should create independent copy", () => {
        const original = new SearchQuery({
          text: "test",
          tags: ["react", "component"],
        });

        const clone = original.clone();

        // Modify clone
        clone.text = "modified";
        clone.tags?.push("new-tag");

        // Original should be unchanged
        expect(original.text).toBe("test");
        expect(original.tags).not.toContain("new-tag");
      });
    });

    describe("toPlainObject", () => {
      it("should convert to plain object", () => {
        const queryData: ISearchQuery = {
          text: "test",
          language: "javascript",
          tags: ["react"],
          sortBy: "title",
          sortOrder: "asc",
        };

        const query = new SearchQuery(queryData);
        const plain = query.toPlainObject();

        expect(plain).toEqual(queryData);
      });

      it("should create independent arrays", () => {
        const query = new SearchQuery({ tags: ["react"] });
        const plain = query.toPlainObject();

        // Modify the returned array
        plain.tags?.push("new-tag");

        // Original query should be unchanged
        expect(query.tags).not.toContain("new-tag");
      });
    });

    describe("toJSON", () => {
      it("should convert to JSON format", () => {
        const query = new SearchQuery({
          text: "test",
          language: "javascript",
        });

        const json = query.toJSON();

        expect(json.text).toBe("test");
        expect(json.language).toBe("javascript");
      });
    });
  });
});
