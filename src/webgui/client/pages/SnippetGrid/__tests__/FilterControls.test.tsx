import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import FilterControls from "../components/FilterControls";

const mockFilters = {
  search: "",
  language: "",
  tags: [],
  category: "",
  sortBy: "createdAt" as const,
  sortOrder: "desc" as const,
};

const mockProps = {
  filters: mockFilters,
  onFilterChange: vi.fn(),
  availableLanguages: ["javascript", "python", "typescript", "java"],
  availableTags: ["react", "node", "api", "utility", "test"],
  availableCategories: ["frontend", "backend", "utility", "example"],
};

describe("FilterControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input", () => {
    render(<FilterControls {...mockProps} />);

    expect(
      screen.getByPlaceholderText("Search snippets...")
    ).toBeInTheDocument();
  });

  it("renders show/hide filters button", () => {
    render(<FilterControls {...mockProps} />);

    expect(screen.getByText("Show Filters")).toBeInTheDocument();
  });

  it("expands filter controls when show filters is clicked", async () => {
    render(<FilterControls {...mockProps} />);

    const showFiltersButton = screen.getByText("Show Filters");
    fireEvent.click(showFiltersButton);

    await waitFor(() => {
      expect(screen.getByText("Hide Filters")).toBeInTheDocument();
      expect(screen.getByLabelText("Language")).toBeInTheDocument();
      expect(screen.getByLabelText("Category")).toBeInTheDocument();
      expect(screen.getByLabelText("Sort By")).toBeInTheDocument();
      expect(screen.getByLabelText("Order")).toBeInTheDocument();
    });
  });

  it("collapses filter controls when hide filters is clicked", async () => {
    render(<FilterControls {...mockProps} />);

    // First expand
    const showFiltersButton = screen.getByText("Show Filters");
    fireEvent.click(showFiltersButton);

    await waitFor(() => {
      expect(screen.getByText("Hide Filters")).toBeInTheDocument();
    });

    // Then collapse
    const hideFiltersButton = screen.getByText("Hide Filters");
    fireEvent.click(hideFiltersButton);

    await waitFor(() => {
      expect(screen.getByText("Show Filters")).toBeInTheDocument();
      expect(screen.queryByLabelText("Language")).not.toBeInTheDocument();
    });
  });

  it("calls onFilterChange when search input changes", () => {
    const onFilterChange = vi.fn();
    render(<FilterControls {...mockProps} onFilterChange={onFilterChange} />);

    const searchInput = screen.getByPlaceholderText("Search snippets...");
    fireEvent.change(searchInput, { target: { value: "test search" } });

    expect(onFilterChange).toHaveBeenCalledWith({ search: "test search" });
  });

  it("displays current search value", () => {
    const filtersWithSearch = { ...mockFilters, search: "existing search" };
    render(<FilterControls {...mockProps} filters={filtersWithSearch} />);

    const searchInput = screen.getByPlaceholderText("Search snippets...");
    expect(searchInput).toHaveValue("existing search");
  });

  it("renders language filter options", async () => {
    render(<FilterControls {...mockProps} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      const languageSelect = screen.getByLabelText("Language");
      expect(languageSelect).toBeInTheDocument();

      // Check that options are present
      expect(screen.getByText("All Languages")).toBeInTheDocument();
      expect(screen.getByText("javascript")).toBeInTheDocument();
      expect(screen.getByText("python")).toBeInTheDocument();
    });
  });

  it("calls onFilterChange when language filter changes", async () => {
    const onFilterChange = vi.fn();
    render(<FilterControls {...mockProps} onFilterChange={onFilterChange} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      const languageSelect = screen.getByLabelText("Language");
      fireEvent.change(languageSelect, { target: { value: "javascript" } });
    });

    expect(onFilterChange).toHaveBeenCalledWith({ language: "javascript" });
  });

  it("renders category filter options", async () => {
    render(<FilterControls {...mockProps} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      const categorySelect = screen.getByLabelText("Category");
      expect(categorySelect).toBeInTheDocument();

      expect(screen.getByText("All Categories")).toBeInTheDocument();
      expect(screen.getByText("frontend")).toBeInTheDocument();
      expect(screen.getByText("backend")).toBeInTheDocument();
    });
  });

  it("calls onFilterChange when category filter changes", async () => {
    const onFilterChange = vi.fn();
    render(<FilterControls {...mockProps} onFilterChange={onFilterChange} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      const categorySelect = screen.getByLabelText("Category");
      fireEvent.change(categorySelect, { target: { value: "frontend" } });
    });

    expect(onFilterChange).toHaveBeenCalledWith({ category: "frontend" });
  });

  it("renders sort options", async () => {
    render(<FilterControls {...mockProps} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      const sortBySelect = screen.getByLabelText("Sort By");
      const sortOrderSelect = screen.getByLabelText("Order");

      expect(sortBySelect).toBeInTheDocument();
      expect(sortOrderSelect).toBeInTheDocument();

      expect(screen.getByText("Created Date")).toBeInTheDocument();
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Usage Count")).toBeInTheDocument();
      expect(screen.getByText("Descending")).toBeInTheDocument();
      expect(screen.getByText("Ascending")).toBeInTheDocument();
    });
  });

  it("calls onFilterChange when sort options change", async () => {
    const onFilterChange = vi.fn();
    render(<FilterControls {...mockProps} onFilterChange={onFilterChange} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      const sortBySelect = screen.getByLabelText("Sort By");
      fireEvent.change(sortBySelect, { target: { value: "title" } });
    });

    expect(onFilterChange).toHaveBeenCalledWith({ sortBy: "title" });
  });

  it("renders tag input and available tags", async () => {
    render(<FilterControls {...mockProps} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      expect(screen.getByLabelText("Tags")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Add tag and press Enter")
      ).toBeInTheDocument();

      // Check available tags
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.getByText("node")).toBeInTheDocument();
      expect(screen.getByText("api")).toBeInTheDocument();
    });
  });

  it("adds tag when available tag is clicked", async () => {
    const onFilterChange = vi.fn();
    render(<FilterControls {...mockProps} onFilterChange={onFilterChange} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      const reactTag = screen.getByText("react");
      fireEvent.click(reactTag);
    });

    expect(onFilterChange).toHaveBeenCalledWith({ tags: ["react"] });
  });

  it("adds tag when enter is pressed in tag input", async () => {
    const onFilterChange = vi.fn();
    render(<FilterControls {...mockProps} onFilterChange={onFilterChange} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      const tagInput = screen.getByPlaceholderText("Add tag and press Enter");
      fireEvent.change(tagInput, { target: { value: "custom-tag" } });
      fireEvent.keyPress(tagInput, {
        key: "Enter",
        code: "Enter",
        charCode: 13,
      });
    });

    expect(onFilterChange).toHaveBeenCalledWith({ tags: ["custom-tag"] });
  });

  it("displays selected tags", async () => {
    const filtersWithTags = { ...mockFilters, tags: ["react", "custom-tag"] };
    render(<FilterControls {...mockProps} filters={filtersWithTags} />);

    // First expand the filters
    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      expect(screen.getByText("Selected Tags:")).toBeInTheDocument();
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.getByText("custom-tag")).toBeInTheDocument();
    });
  });

  it("removes tag when remove button is clicked", async () => {
    const onFilterChange = vi.fn();
    const filtersWithTags = { ...mockFilters, tags: ["react", "custom-tag"] };
    render(
      <FilterControls
        {...mockProps}
        filters={filtersWithTags}
        onFilterChange={onFilterChange}
      />
    );

    // First expand the filters
    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      const removeButtons = screen.getAllByText("×");
      fireEvent.click(removeButtons[0]); // Remove first tag
    });

    expect(onFilterChange).toHaveBeenCalledWith({ tags: ["custom-tag"] });
  });

  it("shows clear all button when filters are active", () => {
    const filtersWithSearch = { ...mockFilters, search: "test" };
    render(<FilterControls {...mockProps} filters={filtersWithSearch} />);

    expect(screen.getByText("Clear All")).toBeInTheDocument();
  });

  it("does not show clear all button when no filters are active", () => {
    render(<FilterControls {...mockProps} />);

    expect(screen.queryByText("Clear All")).not.toBeInTheDocument();
  });

  it("clears all filters when clear all is clicked", () => {
    const onFilterChange = vi.fn();
    const filtersWithValues = {
      search: "test",
      language: "javascript",
      tags: ["react"],
      category: "frontend",
      sortBy: "title" as const,
      sortOrder: "asc" as const,
    };
    render(
      <FilterControls
        {...mockProps}
        filters={filtersWithValues}
        onFilterChange={onFilterChange}
      />
    );

    const clearAllButton = screen.getByText("Clear All");
    fireEvent.click(clearAllButton);

    expect(onFilterChange).toHaveBeenCalledWith({
      search: "",
      language: "",
      tags: [],
      category: "",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("filters available tags to exclude already selected ones", async () => {
    const filtersWithTags = { ...mockFilters, tags: ["react"] };
    render(<FilterControls {...mockProps} filters={filtersWithTags} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      // react should not be in available tags since it's already selected
      const availableTags = screen.queryAllByText("react");
      // Should only appear in selected tags, not in available tags
      expect(availableTags.length).toBe(1);

      // Other tags should still be available
      expect(screen.getByText("node")).toBeInTheDocument();
      expect(screen.getByText("api")).toBeInTheDocument();
    });
  });

  it("limits available tags display to 10 items", async () => {
    const manyTags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    const propsWithManyTags = { ...mockProps, availableTags: manyTags };

    render(<FilterControls {...propsWithManyTags} />);

    fireEvent.click(screen.getByText("Show Filters"));

    await waitFor(() => {
      // Should only show first 10 tags
      expect(screen.getByText("tag0")).toBeInTheDocument();
      expect(screen.getByText("tag9")).toBeInTheDocument();
      expect(screen.queryByText("tag10")).not.toBeInTheDocument();
    });
  });
});
