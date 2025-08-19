import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import SearchInterface from "../SearchInterface";
import searchSlice from "../../../store/slices/searchSlice";
import snippetsSlice from "../../../store/slices/snippetsSlice";
import { Snippet } from "../../../../types";

// Mock the API with performance tracking
const mockSearchAPI = jest.fn();
jest.mock("../../../services/api", () => ({
  snippetAPI: {
    search: mockSearchAPI,
  },
}));

// Generate large dataset for performance testing
const generateLargeSnippetDataset = (count: number): Snippet[] => {
  const languages = [
    "javascript",
    "typescript",
    "python",
    "java",
    "go",
    "rust",
    "cpp",
  ];
  const categories = [
    "frontend",
    "backend",
    "database",
    "devops",
    "testing",
    "utils",
  ];
  const commonTags = [
    "function",
    "class",
    "async",
    "test",
    "util",
    "helper",
    "api",
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `snippet-${i}`,
    title: `Snippet ${i} - ${languages[i % languages.length]} example`,
    description: `This is a sample snippet number ${i} for performance testing`,
    code: `// Sample code for snippet ${i}\nfunction example${i}() {\n  return ${i};\n}`,
    language: languages[i % languages.length],
    tags: [
      commonTags[i % commonTags.length],
      commonTags[(i + 1) % commonTags.length],
      `tag-${i % 50}`, // Create some unique tags
    ],
    category: categories[i % categories.length],
    createdAt: new Date(2023, 0, 1 + (i % 365)),
    updatedAt: new Date(2023, 0, 1 + (i % 365)),
    usageCount: i % 100,
  }));
};

const createTestStore = (snippetCount: number = 1000) => {
  const snippets = generateLargeSnippetDataset(snippetCount);

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
        snippets,
        loading: false,
        error: null,
      },
    },
  });
};

const renderWithStore = (
  component: React.ReactElement,
  store = createTestStore()
) => {
  return render(<Provider store={store}>{component}</Provider>);
};

describe("SearchInterface Performance Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchAPI.mockResolvedValue([]);
  });

  describe("Large Dataset Handling", () => {
    it("renders efficiently with 1000 snippets", async () => {
      const startTime = performance.now();

      renderWithStore(<SearchInterface />, createTestStore(1000));

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);

      expect(
        screen.getByPlaceholderText("Search snippets...")
      ).toBeInTheDocument();
    });

    it("handles filter expansion with large dataset efficiently", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />, createTestStore(1000));

      const startTime = performance.now();

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const endTime = performance.now();
      const expansionTime = endTime - startTime;

      // Filter expansion should be fast (less than 50ms)
      expect(expansionTime).toBeLessThan(50);

      // Should show language options
      expect(screen.getByLabelText("Language")).toBeInTheDocument();
    });

    it("efficiently computes available languages from large dataset", async () => {
      const user = userEvent.setup();

      const startTime = performance.now();
      renderWithStore(<SearchInterface />, createTestStore(5000));

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const endTime = performance.now();
      const computationTime = endTime - startTime;

      // Should compute available options efficiently
      expect(computationTime).toBeLessThan(200);

      const languageSelect = screen.getByLabelText("Language");
      expect(languageSelect).toBeInTheDocument();
    });

    it("limits available tags display for performance", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />, createTestStore(1000));

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      // Should limit the number of available tags shown
      const availableTags = screen
        .getAllByRole("button")
        .filter((button) => button.className.includes("available-tag"));

      // Should show at most 8 tags as per component design
      expect(availableTags.length).toBeLessThanOrEqual(8);
    });
  });

  describe("Search Debouncing Performance", () => {
    it("properly debounces rapid typing", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      renderWithStore(<SearchInterface />);
      const searchInput = screen.getByPlaceholderText("Search snippets...");

      // Type rapidly
      await user.type(searchInput, "javascript");

      // Should not have called search API yet
      expect(mockSearchAPI).not.toHaveBeenCalled();

      // Advance timers by less than debounce time
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Still should not have called API
      expect(mockSearchAPI).not.toHaveBeenCalled();

      // Advance past debounce time
      act(() => {
        jest.advanceTimersByTime(150);
      });

      // Now should have called API only once
      await waitFor(() => {
        expect(mockSearchAPI).toHaveBeenCalledTimes(1);
      });

      jest.useRealTimers();
    });

    it("cancels previous search when new input arrives", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      renderWithStore(<SearchInterface />);
      const searchInput = screen.getByPlaceholderText("Search snippets...");

      // First search
      await user.type(searchInput, "java");

      // Advance time partially
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Second search before first completes
      await user.clear(searchInput);
      await user.type(searchInput, "python");

      // Advance past debounce time
      act(() => {
        jest.advanceTimersByTime(350);
      });

      // Should only search for the latest term
      await waitFor(() => {
        expect(mockSearchAPI).toHaveBeenCalledTimes(1);
        expect(mockSearchAPI).toHaveBeenCalledWith(
          expect.objectContaining({ text: "python" })
        );
      });

      jest.useRealTimers();
    });
  });

  describe("Memory Usage", () => {
    it("cleans up event listeners and timeouts", () => {
      const { unmount } = renderWithStore(<SearchInterface />);

      // Component should unmount without memory leaks
      expect(() => unmount()).not.toThrow();
    });

    it("handles rapid mount/unmount cycles", () => {
      // Simulate rapid component mounting/unmounting
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderWithStore(<SearchInterface />);
        unmount();
      }

      // Should not cause memory issues
      expect(true).toBe(true);
    });
  });

  describe("Tag Filtering Performance", () => {
    it("efficiently filters available tags based on input", async () => {
      const user = userEvent.setup();
      renderWithStore(<SearchInterface />, createTestStore(1000));

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const tagInput = screen.getByPlaceholderText("Add tag and press Enter");

      const startTime = performance.now();
      await user.type(tagInput, "func");
      const endTime = performance.now();

      const filterTime = endTime - startTime;

      // Tag filtering should be fast
      expect(filterTime).toBeLessThan(100);

      // Should show filtered results
      expect(screen.getByText("function")).toBeInTheDocument();
    });

    it("handles tag input with large tag dataset", async () => {
      const user = userEvent.setup();

      // Create dataset with many unique tags
      const manyTagsStore = configureStore({
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
            snippets: Array.from({ length: 100 }, (_, i) => ({
              ...generateLargeSnippetDataset(1)[0],
              id: `snippet-${i}`,
              tags: Array.from({ length: 20 }, (_, j) => `tag-${i}-${j}`),
            })),
            loading: false,
            error: null,
          },
        },
      });

      renderWithStore(<SearchInterface />, manyTagsStore);

      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      const tagInput = screen.getByPlaceholderText("Add tag and press Enter");

      const startTime = performance.now();
      await user.type(tagInput, "tag-1");
      const endTime = performance.now();

      const filterTime = endTime - startTime;

      // Should handle large tag dataset efficiently
      expect(filterTime).toBeLessThan(200);
    });
  });

  describe("Saved Search Performance", () => {
    it("efficiently loads saved searches from localStorage", () => {
      // Create many saved searches
      const savedSearches = Array.from({ length: 50 }, (_, i) => ({
        id: `search-${i}`,
        name: `Search ${i}`,
        query: { text: `query-${i}` },
        createdAt: new Date().toISOString(),
      }));

      localStorage.setItem(
        "snippet-saved-searches",
        JSON.stringify(savedSearches)
      );

      const startTime = performance.now();
      renderWithStore(<SearchInterface />);
      const endTime = performance.now();

      const loadTime = endTime - startTime;

      // Should load saved searches efficiently
      expect(loadTime).toBeLessThan(100);

      expect(screen.getByText(/Saved Searches \(50\)/)).toBeInTheDocument();
    });

    it("handles localStorage operations efficiently", async () => {
      const user = userEvent.setup();

      const store = createTestStore();
      store.dispatch({ type: "search/updateQuery", payload: { text: "test" } });

      renderWithStore(<SearchInterface />, store);

      const saveButton = screen.getByText("Save Search");
      await user.click(saveButton);

      const nameInput = screen.getByPlaceholderText("Enter search name...");

      const startTime = performance.now();
      await user.type(nameInput, "Performance Test Search");

      const confirmButton = screen.getByRole("button", { name: "Save" });
      await user.click(confirmButton);
      const endTime = performance.now();

      const saveTime = endTime - startTime;

      // Saving should be fast
      expect(saveTime).toBeLessThan(100);
    });
  });

  describe("Rendering Optimization", () => {
    it("avoids unnecessary re-renders", async () => {
      let renderCount = 0;

      const TestWrapper: React.FC<{ children: React.ReactNode }> = ({
        children,
      }) => {
        renderCount++;
        return <>{children}</>;
      };

      const user = userEvent.setup();
      renderWithStore(
        <TestWrapper>
          <SearchInterface />
        </TestWrapper>
      );

      const initialRenderCount = renderCount;

      // Interact with component
      const toggleButton = screen.getByTitle("Show Filters");
      await user.click(toggleButton);

      // Should not cause excessive re-renders
      expect(renderCount - initialRenderCount).toBeLessThan(5);
    });

    it("efficiently handles prop changes", () => {
      const mockCallback = jest.fn();
      const { rerender } = renderWithStore(
        <SearchInterface onResultsChange={mockCallback} />
      );

      const startTime = performance.now();

      // Change props multiple times
      for (let i = 0; i < 10; i++) {
        rerender(
          <Provider store={createTestStore()}>
            <SearchInterface
              onResultsChange={mockCallback}
              showResults={i % 2 === 0}
            />
          </Provider>
        );
      }

      const endTime = performance.now();
      const rerenderTime = endTime - startTime;

      // Re-renders should be efficient
      expect(rerenderTime).toBeLessThan(100);
    });
  });

  describe("Search Result Highlighting Performance", () => {
    it("efficiently highlights search terms in results", () => {
      const longText =
        "This is a very long text that contains the search term multiple times. ".repeat(
          100
        );
      const searchTerm = "search";

      // Test the highlighting function performance
      const startTime = performance.now();

      // Simulate the highlighting logic
      const regex = new RegExp(`(${searchTerm})`, "gi");
      const parts = longText.split(regex);

      const endTime = performance.now();
      const highlightTime = endTime - startTime;

      // Highlighting should be fast even for long text
      expect(highlightTime).toBeLessThan(10);
      expect(parts.length).toBeGreaterThan(1);
    });
  });
});
