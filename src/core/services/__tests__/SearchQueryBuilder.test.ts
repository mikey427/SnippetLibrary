import { SearchQueryBuilder, SearchPatterns } from "../SearchQueryBuilder";
import { SearchQueryInterface } from "../../../types";

describe("SearchQueryBuilder", () => {
  let builder: SearchQueryBuilder;

  beforeEach(() => {
    builder = SearchQueryBuilder.create();
    // Clear any saved searches from previous tests
    const savedSearches = builder.getSavedSearches();
    savedSearches.forEach((search) => builder.deleteSaved(search.id));
  });

  describe("basic query building", () => {
    it("should create empty query by default", () => {
      const result = builder.build();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it("should build text query", () => {
      const result = builder.withText("react component").build();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe("react component");
      }
    });

    it("should build language query", () => {
      const result = builder.withLanguage("javascript").build();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe("javascript");
      }
    });

    it("should build tags query", () => {
      const result = builder.withTags(["react", "component"]).build();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(["react", "component"]);
      }
    });

    it("should add individual tags", () => {
      const result = builder
        .addTag("react")
        .addTag("component")
        .addTag("react") // Duplicate should not be added
        .build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(["react", "component"]);
      }
    });

    it("should build category query", () => {
      const result = builder.withCategory("React").build();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe("React");
      }
    });

    it("should build date range query", () => {
      const start = new Date("2024-01-01");
      const end = new Date("2024-12-31");
      const result = builder.withDateRange(start, end).build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateRange).toEqual({ start, end });
      }
    });

    it("should build date range from strings", () => {
      const result = builder
        .withDateRangeString("2024-01-01", "2024-12-31")
        .build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateRange?.start).toEqual(new Date("2024-01-01"));
        expect(result.data.dateRange?.end).toEqual(new Date("2024-12-31"));
      }
    });

    it("should build last N days query", () => {
      const result = builder.withLastDays(7).build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateRange).toBeDefined();
        expect(result.data.dateRange!.start).toBeInstanceOf(Date);
        expect(result.data.dateRange!.end).toBeInstanceOf(Date);
      }
    });

    it("should build sorting query", () => {
      const result = builder.sortBy("usageCount", "desc").build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe("usageCount");
        expect(result.data.sortOrder).toBe("desc");
      }
    });

    it("should default sort order to asc", () => {
      const result = builder.sortBy("title").build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe("title");
        expect(result.data.sortOrder).toBe("asc");
      }
    });
  });

  describe("advanced filters", () => {
    it("should add contains filter", () => {
      const result = builder.contains("title", "react", true).build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filters).toHaveLength(1);
        expect(result.data.filters![0]).toEqual({
          field: "title",
          operator: "contains",
          value: "react",
          caseSensitive: true,
        });
      }
    });

    it("should add equals filter", () => {
      const result = builder.equals("language", "javascript").build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filters).toHaveLength(1);
        expect(result.data.filters![0]).toEqual({
          field: "language",
          operator: "equals",
          value: "javascript",
          caseSensitive: false,
        });
      }
    });

    it("should add starts with filter", () => {
      const result = builder.startsWith("title", "React").build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filters![0].operator).toBe("startsWith");
      }
    });

    it("should add ends with filter", () => {
      const result = builder.endsWith("title", "Component").build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filters![0].operator).toBe("endsWith");
      }
    });

    it("should add regex filter", () => {
      const result = builder.regex("code", "function\\s+\\w+").build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filters![0].operator).toBe("regex");
        expect(result.data.filters![0].value).toBe("function\\s+\\w+");
      }
    });

    it("should add not filter", () => {
      const result = builder.not("category", "deprecated").build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filters![0].operator).toBe("not");
      }
    });

    it("should add multiple filters", () => {
      const result = builder
        .contains("title", "react")
        .equals("language", "javascript")
        .not("category", "deprecated")
        .build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filters).toHaveLength(3);
      }
    });

    it("should set filter combination operator", () => {
      const result = builder
        .contains("title", "react")
        .contains("description", "component")
        .combineWith("or")
        .build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.operator).toBe("or");
      }
    });
  });

  describe("complex queries", () => {
    it("should build complex query with all features", () => {
      const result = builder
        .withText("react component")
        .withLanguage("javascript")
        .withTags(["react", "frontend"])
        .withCategory("React")
        .withLastDays(30)
        .sortBy("usageCount", "desc")
        .contains("description", "functional")
        .not("tags", "deprecated")
        .combineWith("and")
        .build();

      expect(result.success).toBe(true);
      if (result.success) {
        const query = result.data;
        expect(query.text).toBe("react component");
        expect(query.language).toBe("javascript");
        expect(query.tags).toEqual(["react", "frontend"]);
        expect(query.category).toBe("React");
        expect(query.dateRange).toBeDefined();
        expect(query.sortBy).toBe("usageCount");
        expect(query.sortOrder).toBe("desc");
        expect(query.filters).toHaveLength(2);
        expect(query.operator).toBe("and");
      }
    });
  });

  describe("validation", () => {
    it("should validate date range", () => {
      const start = new Date("2024-12-31");
      const end = new Date("2024-01-01");
      const result = builder.withDateRange(start, end).build();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain(
          "Start date must be before end date"
        );
      }
    });

    it("should validate invalid date strings", () => {
      expect(() => {
        builder.withDateRangeString("invalid-date", "2024-12-31");
      }).toThrow("Invalid date format");
    });

    it("should validate regex patterns", () => {
      const result = builder.regex("code", "[invalid regex").build();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Invalid regex pattern");
      }
    });
  });

  describe("utility methods", () => {
    it("should reset builder", () => {
      builder.withText("test").withLanguage("javascript");
      builder.reset();
      const result = builder.build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it("should clone builder", () => {
      const original = builder.withText("test").withLanguage("javascript");
      const cloned = original.clone();

      cloned.withCategory("Test");

      const originalResult = original.build();
      const clonedResult = cloned.build();

      expect(originalResult.success).toBe(true);
      expect(clonedResult.success).toBe(true);

      if (originalResult.success && clonedResult.success) {
        expect(originalResult.data.category).toBeUndefined();
        expect(clonedResult.data.category).toBe("Test");
      }
    });

    it("should load from existing query", () => {
      const existingQuery: SearchQueryInterface = {
        text: "react",
        language: "javascript",
        tags: ["component"],
      };

      const result = builder.fromQuery(existingQuery).build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(existingQuery);
      }
    });

    it("should build as SearchQuery instance", () => {
      const result = builder.withText("react").buildAsSearchQuery();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.text).toBe("react");
      }
    });

    it("should generate query summary", () => {
      builder
        .withText("react")
        .withLanguage("javascript")
        .withTags(["component"])
        .sortBy("usageCount", "desc");

      const summary = builder.getSummary();

      expect(summary).toContain('text: "react"');
      expect(summary).toContain("language: javascript");
      expect(summary).toContain("tags: [component]");
      expect(summary).toContain("sort: usageCount desc");
    });

    it("should return empty query summary for empty builder", () => {
      const summary = builder.getSummary();
      expect(summary).toBe("empty query");
    });
  });

  describe("saved searches", () => {
    it("should save query with name", () => {
      const result = builder
        .withText("react component")
        .withLanguage("javascript")
        .saveAs("My React Search");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("My React Search");
        expect(result.data.id).toBeDefined();
        expect(result.data.createdAt).toBeInstanceOf(Date);
        expect(result.data.useCount).toBe(0);
      }
    });

    it("should load saved search", () => {
      const saveResult = builder
        .withText("react")
        .withLanguage("javascript")
        .saveAs("Test Search");

      expect(saveResult.success).toBe(true);

      if (saveResult.success) {
        const newBuilder = SearchQueryBuilder.create();
        const loadResult = newBuilder.loadSaved(saveResult.data.id);

        expect(loadResult.success).toBe(true);

        const queryResult = newBuilder.build();
        expect(queryResult.success).toBe(true);
        if (queryResult.success) {
          expect(queryResult.data.text).toBe("react");
          expect(queryResult.data.language).toBe("javascript");
        }
      }
    });

    it("should increment use count when loading saved search", () => {
      const saveResult = builder.withText("test").saveAs("Test");
      expect(saveResult.success).toBe(true);

      if (saveResult.success) {
        const newBuilder = SearchQueryBuilder.create();
        newBuilder.loadSaved(saveResult.data.id);

        const savedSearches = newBuilder.getSavedSearches();
        expect(savedSearches[0].useCount).toBe(1);
      }
    });

    it("should get all saved searches sorted by last used", async () => {
      builder.withText("first").saveAs("First");

      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));

      builder.reset().withText("second").saveAs("Second");

      const savedSearches = builder.getSavedSearches();
      expect(savedSearches).toHaveLength(2);
      expect(savedSearches[0].name).toBe("Second"); // Most recent first
    });

    it("should delete saved search", () => {
      const saveResult = builder.withText("test").saveAs("Test");
      expect(saveResult.success).toBe(true);

      if (saveResult.success) {
        const deleteResult = builder.deleteSaved(saveResult.data.id);
        expect(deleteResult.success).toBe(true);

        const savedSearches = builder.getSavedSearches();
        expect(savedSearches).toHaveLength(0);
      }
    });

    it("should handle loading non-existent saved search", () => {
      const result = builder.loadSaved("non-existent-id");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Saved search not found");
      }
    });

    it("should handle deleting non-existent saved search", () => {
      const result = builder.deleteSaved("non-existent-id");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Saved search not found");
      }
    });
  });
});

describe("SearchPatterns", () => {
  describe("predefined patterns", () => {
    it("should create recently created pattern", () => {
      const result = SearchPatterns.recentlyCreated(7).build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateRange).toBeDefined();
        expect(result.data.sortBy).toBe("createdAt");
        expect(result.data.sortOrder).toBe("desc");
      }
    });

    it("should create most used pattern", () => {
      const result = SearchPatterns.mostUsed().build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe("usageCount");
        expect(result.data.sortOrder).toBe("desc");
      }
    });

    it("should create by language pattern", () => {
      const result = SearchPatterns.byLanguage("javascript").build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe("javascript");
      }
    });

    it("should create with tags pattern", () => {
      const result = SearchPatterns.withTags("react", "component").build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(["react", "component"]);
      }
    });

    it("should create unused pattern", () => {
      const result = SearchPatterns.unused().build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filters).toHaveLength(1);
        expect(result.data.sortBy).toBe("createdAt");
        expect(result.data.sortOrder).toBe("desc");
      }
    });

    it("should create full text pattern", () => {
      const result = SearchPatterns.fullText("react component").build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe("react component");
        expect(result.data.operator).toBe("or");
        expect(result.data.filters).toHaveLength(3); // title, description, code
      }
    });
  });
});
