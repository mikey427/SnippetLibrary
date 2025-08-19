import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import SearchInterface from "../SearchInterface";
import searchSlice from "../../../store/slices/searchSlice";
import snippetsSlice from "../../../store/slices/snippetsSlice";
import { Snippet } from "../../../../types";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import { describe } from "vitest";
import { beforeEach } from "vitest";
import { describe } from "vitest";

// Mock the API
jest.mock("../../../services/api", () => ({
  snippetAPI: {
    search: jest.fn(),
  },
}));

const mockSnippets: Snippet[] = [
  {
    id: "1",
    title: "React Hook",
    description: "Custom React hook example",
    code: "const useCustomHook = () => { return true; }",
    language: "javascript",
    tags: ["react", "hooks"],
    category: "frontend",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    usageCount: 5,
  },
  {
    id: "2",
    title: "Python Function",
    description: "Utility function in Python",
    code: "def utility_function(): pass",
    language: "python",
    tags: ["utility", "function"],
    category: "backend",
    createdAt: new Date("2023-01-02"),
    updatedAt: new Date("2023-01-02"),
    usageCount: 3,
  },
  {
    id: "3",
    title: "CSS Animation",
    description: "Smooth CSS animation",
    code: "@keyframes slide { from { opacity: 0; } to { opacity: 1; } }",
    language: "css",
    tags: ["animation", "css"],
    category: "frontend",
    createdAt: new Date("2023-01-03"),
    updatedAt: new Date("2023-01-03"),
    usageCount: 8,
  },
];

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      search: searchSlice,
      snippets: snippetsSlice,
    },
    preloadedState: {
      search: {
        query: {
          text: "",
          language: "",
          tags: [],
          category: "",
          sortBy: "title",
          sortOrder: "asc",
        },
        results: [],
        loading: false,
        error: null,
        history: [],
      },
      snippets: {
        snippets: mockSnippets,
        loading: false,
        error: null,
      },
      ...initialState,
    },
  });
};

const renderWithStore = (
  component: React.ReactElement,
  store = createTestStore()
) => {
  return render(<Provider store={store}>{component}</Provider>);
};

describe("SearchInterface", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  describe("Basic Rendering", () => {
    it("renders search input", () => {
      renderWithStore(<SearchInterface />);
      expect(
        screen.getByPlaceholderText("Search snippets...")
      ).toBeInTheDocument();
    });

    it("renders filter toggle button", () => {
      renderWithStore(<SearchInterface />);
      expect(screen.getByTitle("Show Filters")).toBeInTheDocument();
    });

    it("renders in compact mode", () => {
      renderWithStore(<SearchInterface compact />);
      const container = screen
        .getByRole("textbox")
        .closest(".search-interface");
      expect(container).toHaveClass("compact");
    });
  });

  describe("Search Input", () => {
    it("updates search text on input", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const searchInput = screen.getByPlaceholderText("Search snippets...");
      await user.type(searchInput, "react");

      expect(searchInput).toHaveValue("react");
    });

    it("debounces search input", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      renderWithStore(<SearchInterface />);
      const searchInput = screen.getByPlaceholderText("Search snippets...");

      await user.type(searchInput, "react");

      // Should not trigger search immediately
      expect(
        require("../../../services/api").snippetAPI.search
      ).not.toHaveBeenCalled();

      // Advance timers to trigger debounced search
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(
          require("../../../services/api").snippetAPI.search
        ).toHaveBeenCalledWith(expect.objectContaining({ text: "react" }));
      });

      jest.useRealTimers();
    });
  });

  describe("Filter Controls", () => {
    it("shows filters when expanded", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      expect(screen.getByLabelText("Language")).toBeInTheDocument();
      expect(screen.getByLabelText("Category")).toBeInTheDocument();
      expect(screen.getByLabelText("Sort By")).toBeInTheDocument();
    });

    it("populates language options from snippets", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const languageSelect = screen.getByLabelText("Language");
      expect(languageSelect).toBeInTheDocument();

      // Check that options are populated from mock snippets
      expect(screen.getByText("javascript")).toBeInTheDocument();
      expect(screen.getByText("python")).toBeInTheDocument();
      expect(screen.getByText("css")).toBeInTheDocument();
    });

    it("updates language filter", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const languageSelect = screen.getByLabelText("Language");
      await user.selectOptions(languageSelect, "javascript");

      expect(languageSelect).toHaveValue("javascript");
    });

    it("updates category filter", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const categorySelect = screen.getByLabelText("Category");
      await user.selectOptions(categorySelect, "frontend");

      expect(categorySelect).toHaveValue("frontend");
    });

    it("updates sort options", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const sortBySelect = screen.getByLabelText("Sort By");
      await user.selectOptions(sortBySelect, "usageCount");

      expect(sortBySelect).toHaveValue("usageCount");

      const sortOrderSelect = screen.getByLabelText("Order");
      await user.selectOptions(sortOrderSelect, "desc");

      expect(sortOrderSelect).toHaveValue("desc");
    });
  });

  describe("Tag Management", () => {
    it("adds tags from input", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const tagInput = screen.getByPlaceholderText("Add tag and press Enter");
      await user.type(tagInput, "newtag{enter}");

      expect(screen.getByText("newtag")).toBeInTheDocument();
      expect(tagInput).toHaveValue("");
    });

    it("adds tags from available tags", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      // Available tags should be populated from mock snippets
      const reactTag = screen.getByText("react");
      await user.click(reactTag);

      expect(screen.getByText("Selected Tags:")).toBeInTheDocument();
    });

    it("removes selected tags", async () => {
      const user = userEvent.setup();
      const store = createTestStore({
        search: {
          query: {
            text: "",
            language: "",
            tags: ["react"],
            category: "",
            sortBy: "title",
            sortOrder: "asc",
          },
          results: [],
          loading: false,
          error: null,
          history: [],
        },
      });

      renderWithStore(<SearchInterface />, store);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const removeButton = screen.getByLabelText("Remove react tag");
      await user.click(removeButton);

      expect(screen.queryByText("Selected Tags:")).not.toBeInTheDocument();
    });

    it("filters available tags based on input", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const tagInput = screen.getByPlaceholderText("Add tag and press Enter");
      await user.type(tagInput, "rea");

      // Should show highlighted "react" tag
      expect(screen.getByText("react")).toBeInTheDocument();
      // Should not show unrelated tags
      expect(screen.queryByText("animation")).not.toBeInTheDocument();
    });
  });

  describe("Date Range Filter", () => {
    it("sets date range", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const startDateInput = screen.getByLabelText("Date Range");
      await user.type(startDateInput, "2023-01-01");

      const endDateInputs = screen.getAllByDisplayValue("");
      const endDateInput = endDateInputs.find(
        (input) =>
          input.getAttribute("type") === "date" && input !== startDateInput
      );

      if (endDateInput) {
        await user.type(endDateInput, "2023-12-31");
      }

      expect(startDateInput).toHaveValue("2023-01-01");
    });
  });

  describe("Search History", () => {
    it("shows search history when available", async () => {
      const user = userEvent.setup();
      const store = createTestStore({
        search: {
          query: {
            text: "",
            language: "",
            tags: [],
            category: "",
            sortBy: "title",
            sortOrder: "asc",
          },
          results: [],
          loading: false,
          error: null,
          history: ["react", "python"],
        },
      });

      renderWithStore(<SearchInterface />, store);

      const historyButton = screen.getByTitle("Search History");
      await user.click(historyButton);

      expect(screen.getByText("Recent Searches")).toBeInTheDocument();
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.getByText("python")).toBeInTheDocument();
    });

    it("loads search from history", async () => {
      const user = userEvent.setup();
      const store = createTestStore({
        search: {
          query: {
            text: "",
            language: "",
            tags: [],
            category: "",
            sortBy: "title",
            sortOrder: "asc",
          },
          results: [],
          loading: false,
          error: null,
          history: ["react"],
        },
      });

      renderWithStore(<SearchInterface />, store);

      const historyButton = screen.getByTitle("Search History");
      await user.click(historyButton);

      const historyItem = screen.getByText("react");
      await user.click(historyItem);

      const searchInput = screen.getByPlaceholderText("Search snippets...");
      expect(searchInput).toHaveValue("react");
    });
  });

  describe("Saved Searches", () => {
    it("shows save search dialog", async () => {
      const user = userEvent.setup();
      const store = createTestStore({
        search: {
          query: {
            text: "react",
            language: "",
            tags: [],
            category: "",
            sortBy: "title",
            sortOrder: "asc",
          },
          results: [],
          loading: false,
          error: null,
          history: [],
        },
      });

      renderWithStore(<SearchInterface />, store);

      const saveButton = screen.getByText("Save Search");
      await user.click(saveButton);

      expect(screen.getByText("Save Search")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Enter search name...")
      ).toBeInTheDocument();
    });

    it("saves search with name", async () => {
      const user = userEvent.setup();
      const store = createTestStore({
        search: {
          query: {
            text: "react",
            language: "javascript",
            tags: ["hooks"],
            category: "",
            sortBy: "title",
            sortOrder: "asc",
          },
          results: [],
          loading: false,
          error: null,
          history: [],
        },
      });

      renderWithStore(<SearchInterface />, store);

      const saveButton = screen.getByText("Save Search");
      await user.click(saveButton);

      const nameInput = screen.getByPlaceholderText("Enter search name...");
      await user.type(nameInput, "React Hooks Search");

      const confirmButton = screen.getByRole("button", { name: "Save" });
      await user.click(confirmButton);

      // Should show saved searches button
      expect(screen.getByText(/Saved Searches \(1\)/)).toBeInTheDocument();
    });

    it("loads saved search", async () => {
      const user = userEvent.setup();

      // Pre-populate localStorage with saved search
      const savedSearch = {
        id: "1",
        name: "React Search",
        query: { text: "react", language: "javascript" },
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(
        "snippet-saved-searches",
        JSON.stringify([savedSearch])
      );

      renderWithStore(<SearchInterface />);

      const savedSearchesButton = screen.getByText(/Saved Searches \(1\)/);
      await user.click(savedSearchesButton);

      expect(screen.getByText("React Search")).toBeInTheDocument();

      const loadButton = screen.getByText("React Search");
      await user.click(loadButton);

      const searchInput = screen.getByPlaceholderText("Search snippets...");
      expect(searchInput).toHaveValue("react");
    });
  });

  describe("Clear Filters", () => {
    it("clears all filters", async () => {
      const user = userEvent.setup();
      const store = createTestStore({
        search: {
          query: {
            text: "react",
            language: "javascript",
            tags: ["hooks"],
            category: "frontend",
            sortBy: "usageCount",
            sortOrder: "desc",
          },
          results: [],
          loading: false,
          error: null,
          history: [],
        },
      });

      renderWithStore(<SearchInterface />, store);

      const clearButton = screen.getByText("Clear All");
      await user.click(clearButton);

      const searchInput = screen.getByPlaceholderText("Search snippets...");
      expect(searchInput).toHaveValue("");
    });
  });

  describe("Results Callback", () => {
    it("calls onResultsChange when results update", () => {
      const mockCallback = jest.fn();
      const store = createTestStore({
        search: {
          query: {
            text: "",
            language: "",
            tags: [],
            category: "",
            sortBy: "title",
            sortOrder: "asc",
          },
          results: mockSnippets,
          loading: false,
          error: null,
          history: [],
        },
      });

      renderWithStore(
        <SearchInterface onResultsChange={mockCallback} />,
        store
      );

      expect(mockCallback).toHaveBeenCalledWith(mockSnippets);
    });
  });

  describe("Error Handling", () => {
    it("displays search error", () => {
      const store = createTestStore({
        search: {
          query: {
            text: "",
            language: "",
            tags: [],
            category: "",
            sortBy: "title",
            sortOrder: "asc",
          },
          results: [],
          loading: false,
          error: "Search failed",
          history: [],
        },
      });

      renderWithStore(<SearchInterface />, store);

      expect(screen.getByText("Error: Search failed")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      const store = createTestStore({
        search: {
          query: {
            text: "",
            language: "",
            tags: [],
            category: "",
            sortBy: "title",
            sortOrder: "asc",
          },
          results: [],
          loading: true,
          error: null,
          history: [],
        },
      });

      renderWithStore(<SearchInterface />, store);

      expect(screen.getByText("Searching...")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("handles large number of available tags efficiently", async () => {
      const user = userEvent.setup();

      // Create many snippets with many tags
      const manySnippets = Array.from({ length: 100 }, (_, i) => ({
        ...mockSnippets[0],
        id: `snippet-${i}`,
        tags: [`tag-${i}`, `category-${i % 10}`, "common"],
      }));

      const store = createTestStore({
        snippets: {
          snippets: manySnippets,
          loading: false,
          error: null,
        },
      });

      renderWithStore(<SearchInterface />, store);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      // Should only show limited number of available tags (8 as per component)
      const availableTags = screen
        .getAllByRole("button")
        .filter((button) => button.className.includes("available-tag"));
      expect(availableTags.length).toBeLessThanOrEqual(8);
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      expect(screen.getByLabelText("Language")).toBeInTheDocument();
      expect(screen.getByLabelText("Category")).toBeInTheDocument();
      expect(screen.getByLabelText("Sort By")).toBeInTheDocument();
      expect(screen.getByLabelText("Order")).toBeInTheDocument();
      expect(screen.getByLabelText("Tags")).toBeInTheDocument();
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const searchInput = screen.getByPlaceholderText("Search snippets...");

      // Tab navigation should work
      await user.tab();
      expect(searchInput).toHaveFocus();
    });
  });
});
