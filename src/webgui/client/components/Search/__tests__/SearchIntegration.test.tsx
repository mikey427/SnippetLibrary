import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import SearchInterface from "../SearchInterface";
import searchSlice from "../../../store/slices/searchSlice";
import snippetsSlice from "../../../store/slices/snippetsSlice";
import { Snippet } from "../../../../types";

// Mock API with realistic responses
const mockSearchAPI = jest.fn();
jest.mock("../../../services/api", () => ({
  snippetAPI: {
    search: mockSearchAPI,
  },
}));

const mockSnippets: Snippet[] = [
  {
    id: "1",
    title: "React useState Hook",
    description: "Basic useState hook example for state management",
    code: "const [count, setCount] = useState(0);",
    language: "javascript",
    tags: ["react", "hooks", "state"],
    category: "frontend",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    usageCount: 15,
  },
  {
    id: "2",
    title: "Python List Comprehension",
    description: "Efficient list comprehension in Python",
    code: "squares = [x**2 for x in range(10)]",
    language: "python",
    tags: ["python", "list", "comprehension"],
    category: "backend",
    createdAt: new Date("2023-01-02"),
    updatedAt: new Date("2023-01-02"),
    usageCount: 8,
  },
  {
    id: "3",
    title: "CSS Flexbox Center",
    description: "Center content using flexbox",
    code: ".container { display: flex; justify-content: center; align-items: center; }",
    language: "css",
    tags: ["css", "flexbox", "layout"],
    category: "frontend",
    createdAt: new Date("2023-01-03"),
    updatedAt: new Date("2023-01-03"),
    usageCount: 22,
  },
  {
    id: "4",
    title: "JavaScript Async Function",
    description: "Async function with error handling",
    code: "async function fetchData() { try { const response = await fetch('/api'); return response.json(); } catch (error) { console.error(error); } }",
    language: "javascript",
    tags: ["javascript", "async", "fetch"],
    category: "frontend",
    createdAt: new Date("2023-01-04"),
    updatedAt: new Date("2023-01-04"),
    usageCount: 12,
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

describe("SearchInterface Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe("End-to-End Search Workflows", () => {
    it("performs complete search workflow with text and filters", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      // Mock API response
      const searchResults = [mockSnippets[0], mockSnippets[3]]; // JavaScript snippets
      mockSearchAPI.mockResolvedValue(searchResults);

      const mockCallback = jest.fn();
      renderWithStore(<SearchInterface onResultsChange={mockCallback} />);

      // Step 1: Enter search text
      const searchInput = screen.getByPlaceholderText("Search snippets...");
      await user.type(searchInput, "javascript");

      // Step 2: Expand filters
      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      // Step 3: Set language filter
      const languageSelect = screen.getByLabelText("Language");
      await user.selectOptions(languageSelect, "javascript");

      // Step 4: Add tag filter
      const tagInput = screen.getByPlaceholderText("Add tag and press Enter");
      await user.type(tagInput, "async{enter}");

      // Step 5: Set sorting
      const sortBySelect = screen.getByLabelText("Sort By");
      await user.selectOptions(sortBySelect, "usageCount");

      const sortOrderSelect = screen.getByLabelText("Order");
      await user.selectOptions(sortOrderSelect, "desc");

      // Trigger debounced search
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Verify search was called with correct parameters
      await waitFor(() => {
        expect(mockSearchAPI).toHaveBeenCalledWith({
          text: "javascript",
          language: "javascript",
          tags: ["async"],
          category: "",
          sortBy: "usageCount",
          sortOrder: "desc",
        });
      });

      // Verify callback was called with results
      expect(mockCallback).toHaveBeenCalledWith(searchResults);

      jest.useRealTimers();
    });

    it("handles search error gracefully", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      // Mock API error
      mockSearchAPI.mockRejectedValue(new Error("Network error"));

      renderWithStore(<SearchInterface />);

      const searchInput = screen.getByPlaceholderText("Search snippets...");
      await user.type(searchInput, "test");

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("Error: Network error")).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it("shows loading state during search", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      // Mock delayed API response
      let resolveSearch: (value: any) => void;
      const searchPromise = new Promise((resolve) => {
        resolveSearch = resolve;
      });
      mockSearchAPI.mockReturnValue(searchPromise);

      renderWithStore(<SearchInterface />);

      const searchInput = screen.getByPlaceholderText("Search snippets...");
      await user.type(searchInput, "test");

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText("Searching...")).toBeInTheDocument();
      });

      // Resolve the search
      act(() => {
        resolveSearch!([]);
      });

      await waitFor(() => {
        expect(screen.queryByText("Searching...")).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe("Saved Search Integration", () => {
    it("saves and loads complex search with multiple filters", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      // Set up complex search
      const searchInput = screen.getByPlaceholderText("Search snippets...");
      await user.type(searchInput, "react hooks");

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const languageSelect = screen.getByLabelText("Language");
      await user.selectOptions(languageSelect, "javascript");

      const categorySelect = screen.getByLabelText("Category");
      await user.selectOptions(categorySelect, "frontend");

      const tagInput = screen.getByPlaceholderText("Add tag and press Enter");
      await user.type(tagInput, "react{enter}");
      await user.type(tagInput, "hooks{enter}");

      // Save the search
      const saveButton = screen.getByText("Save Search");
      await user.click(saveButton);

      const nameInput = screen.getByPlaceholderText("Enter search name...");
      await user.type(nameInput, "React Hooks Frontend");

      const confirmButton = screen.getByRole("button", { name: "Save" });
      await user.click(confirmButton);

      // Clear current search
      const clearButton = screen.getByText("Clear All");
      await user.click(clearButton);

      // Verify search is cleared
      expect(searchInput).toHaveValue("");
      expect(languageSelect).toHaveValue("");

      // Load saved search
      const savedSearchesButton = screen.getByText(/Saved Searches \(1\)/);
      await user.click(savedSearchesButton);

      const savedSearchItem = screen.getByText("React Hooks Frontend");
      await user.click(savedSearchItem);

      // Verify search is restored
      expect(searchInput).toHaveValue("react hooks");
      expect(languageSelect).toHaveValue("javascript");
      expect(categorySelect).toHaveValue("frontend");
      expect(screen.getByText("Selected Tags:")).toBeInTheDocument();
    });

    it("manages multiple saved searches", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      // Save first search
      const searchInput = screen.getByPlaceholderText("Search snippets...");
      await user.type(searchInput, "python");

      const saveButton = screen.getByText("Save Search");
      await user.click(saveButton);

      let nameInput = screen.getByPlaceholderText("Enter search name...");
      await user.type(nameInput, "Python Search");

      let confirmButton = screen.getByRole("button", { name: "Save" });
      await user.click(confirmButton);

      // Clear and save second search
      const clearButton = screen.getByText("Clear All");
      await user.click(clearButton);

      await user.type(searchInput, "css");

      const saveButton2 = screen.getByText("Save Search");
      await user.click(saveButton2);

      nameInput = screen.getByPlaceholderText("Enter search name...");
      await user.type(nameInput, "CSS Search");

      confirmButton = screen.getByRole("button", { name: "Save" });
      await user.click(confirmButton);

      // Verify both searches are saved
      const savedSearchesButton = screen.getByText(/Saved Searches \(2\)/);
      await user.click(savedSearchesButton);

      expect(screen.getByText("Python Search")).toBeInTheDocument();
      expect(screen.getByText("CSS Search")).toBeInTheDocument();

      // Delete one search
      const deleteButtons = screen.getAllByText("🗑️");
      await user.click(deleteButtons[0]);

      // Verify count updated
      expect(screen.getByText(/Saved Searches \(1\)/)).toBeInTheDocument();
    });
  });

  describe("Search History Integration", () => {
    it("builds and uses search history", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      mockSearchAPI.mockResolvedValue([]);

      renderWithStore(<SearchInterface />);

      const searchInput = screen.getByPlaceholderText("Search snippets...");

      // Perform multiple searches
      const searches = ["react", "python", "javascript"];

      for (const searchTerm of searches) {
        await user.clear(searchInput);
        await user.type(searchInput, searchTerm);

        act(() => {
          jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
          expect(mockSearchAPI).toHaveBeenCalledWith(
            expect.objectContaining({ text: searchTerm })
          );
        });
      }

      // Check history is available
      const historyButton = screen.getByTitle("Search History");
      await user.click(historyButton);

      expect(screen.getByText("Recent Searches")).toBeInTheDocument();

      // History should be in reverse order (most recent first)
      expect(screen.getByText("javascript")).toBeInTheDocument();
      expect(screen.getByText("python")).toBeInTheDocument();
      expect(screen.getByText("react")).toBeInTheDocument();

      // Use history item
      await user.clear(searchInput);
      const historyItem = screen.getByText("react");
      await user.click(historyItem);

      expect(searchInput).toHaveValue("react");

      jest.useRealTimers();
    });
  });

  describe("Filter Interaction Integration", () => {
    it("combines multiple filter types effectively", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      mockSearchAPI.mockResolvedValue([mockSnippets[0]]);

      renderWithStore(<SearchInterface />);

      // Expand filters
      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      // Set text search
      const searchInput = screen.getByPlaceholderText("Search snippets...");
      await user.type(searchInput, "hook");

      // Set language filter
      const languageSelect = screen.getByLabelText("Language");
      await user.selectOptions(languageSelect, "javascript");

      // Set category filter
      const categorySelect = screen.getByLabelText("Category");
      await user.selectOptions(categorySelect, "frontend");

      // Add multiple tags
      const tagInput = screen.getByPlaceholderText("Add tag and press Enter");
      await user.type(tagInput, "react{enter}");
      await user.type(tagInput, "hooks{enter}");

      // Set date range
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

      // Set sorting
      const sortBySelect = screen.getByLabelText("Sort By");
      await user.selectOptions(sortBySelect, "usageCount");

      const sortOrderSelect = screen.getByLabelText("Order");
      await user.selectOptions(sortOrderSelect, "desc");

      // Trigger search
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Verify all filters are applied
      await waitFor(() => {
        expect(mockSearchAPI).toHaveBeenCalledWith({
          text: "hook",
          language: "javascript",
          tags: ["react", "hooks"],
          category: "frontend",
          dateRange: {
            start: new Date("2023-01-01"),
            end: new Date("2023-12-31"),
          },
          sortBy: "usageCount",
          sortOrder: "desc",
        });
      });

      jest.useRealTimers();
    });

    it("handles filter clearing correctly", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      // Set up filters
      const searchInput = screen.getByPlaceholderText("Search snippets...");
      await user.type(searchInput, "test");

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const languageSelect = screen.getByLabelText("Language");
      await user.selectOptions(languageSelect, "javascript");

      const tagInput = screen.getByPlaceholderText("Add tag and press Enter");
      await user.type(tagInput, "test{enter}");

      // Verify filters are set
      expect(searchInput).toHaveValue("test");
      expect(languageSelect).toHaveValue("javascript");
      expect(screen.getByText("Selected Tags:")).toBeInTheDocument();

      // Clear all filters
      const clearButton = screen.getByText("Clear All");
      await user.click(clearButton);

      // Verify all filters are cleared
      expect(searchInput).toHaveValue("");
      expect(languageSelect).toHaveValue("");
      expect(screen.queryByText("Selected Tags:")).not.toBeInTheDocument();
    });
  });

  describe("Real-time Updates Integration", () => {
    it("updates available options when snippets change", async () => {
      const user = userEvent.setup();
      const store = createTestStore();

      renderWithStore(<SearchInterface />, store);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      // Initial languages
      const languageSelect = screen.getByLabelText("Language");
      expect(screen.getByText("javascript")).toBeInTheDocument();
      expect(screen.getByText("python")).toBeInTheDocument();

      // Add new snippet with different language
      const newSnippet: Snippet = {
        id: "5",
        title: "Go Function",
        description: "Go function example",
        code: 'func main() { fmt.Println("Hello") }',
        language: "go",
        tags: ["go", "function"],
        category: "backend",
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 1,
      };

      // Simulate adding snippet to store
      store.dispatch({
        type: "snippets/addSnippet",
        payload: newSnippet,
      });

      // Re-render to trigger update
      const { rerender } = renderWithStore(<SearchInterface />, store);
      rerender(
        <Provider store={store}>
          <SearchInterface />
        </Provider>
      );

      // Should now include new language option
      await user.click(toggleButton); // Re-expand if needed
      expect(screen.getByText("go")).toBeInTheDocument();
    });
  });

  describe("Accessibility Integration", () => {
    it("maintains focus management during interactions", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const searchInput = screen.getByPlaceholderText("Search snippets...");

      // Focus should start on search input
      await user.click(searchInput);
      expect(searchInput).toHaveFocus();

      // Tab to filter toggle
      await user.tab();
      const toggleButton = screen.getByTitle("Show Filters");
      expect(toggleButton).toHaveFocus();

      // Expand filters
      await user.press("Enter");

      // Should be able to tab through filter controls
      await user.tab();
      const languageSelect = screen.getByLabelText("Language");
      expect(languageSelect).toHaveFocus();
    });

    it("provides proper ARIA labels and descriptions", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      // Check ARIA labels
      expect(screen.getByLabelText("Language")).toBeInTheDocument();
      expect(screen.getByLabelText("Category")).toBeInTheDocument();
      expect(screen.getByLabelText("Sort By")).toBeInTheDocument();
      expect(screen.getByLabelText("Order")).toBeInTheDocument();
      expect(screen.getByLabelText("Tags")).toBeInTheDocument();
      expect(screen.getByLabelText("Date Range")).toBeInTheDocument();
    });
  });

  describe("Error Recovery Integration", () => {
    it("recovers from localStorage errors gracefully", () => {
      // Mock localStorage to throw error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = jest.fn(() => {
        throw new Error("localStorage error");
      });

      // Should not crash when localStorage fails
      expect(() => {
        renderWithStore(<SearchInterface />);
      }).not.toThrow();

      // Should still render basic functionality
      expect(
        screen.getByPlaceholderText("Search snippets...")
      ).toBeInTheDocument();

      // Restore localStorage
      localStorage.getItem = originalGetItem;
    });

    it("handles malformed saved search data", () => {
      // Set malformed data in localStorage
      localStorage.setItem("snippet-saved-searches", "invalid json");

      // Should not crash
      expect(() => {
        renderWithStore(<SearchInterface />);
      }).not.toThrow();

      // Should not show saved searches button
      expect(screen.queryByText(/Saved Searches/)).not.toBeInTheDocument();
    });
  });
});
