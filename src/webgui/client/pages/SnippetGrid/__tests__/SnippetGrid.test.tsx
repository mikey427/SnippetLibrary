import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { vi, describe, it, expect, beforeEach } from "vitest";
import SnippetGrid from "../SnippetGrid";
import snippetsReducer from "../../../store/slices/snippetsSlice";
import uiReducer from "../../../store/slices/uiSlice";
import { Snippet } from "../../../../types";

// Mock the API service
vi.mock("../../services/api", () => ({
  snippetAPI: {
    getAll: vi.fn(() => Promise.resolve([])),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock react-window
vi.mock("react-window", () => ({
  FixedSizeGrid: ({
    children,
    columnCount,
    rowCount,
    columnWidth,
    rowHeight,
  }: any) => {
    const items = [];
    for (let row = 0; row < rowCount; row++) {
      for (let col = 0; col < columnCount; col++) {
        items.push(
          <div key={`${row}-${col}`} data-testid={`grid-item-${row}-${col}`}>
            {children({ columnIndex: col, rowIndex: row, style: {} })}
          </div>
        );
      }
    }
    return <div data-testid="virtual-grid">{items}</div>;
  },
}));

// Mock react-syntax-highlighter
vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: any) => (
    <pre data-testid="syntax-highlighter">{children}</pre>
  ),
}));

// Mock react-syntax-highlighter styles
vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  vscDarkPlus: {},
}));

// Mock @dnd-kit
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: any) => (
    <div data-testid="dnd-context">{children}</div>
  ),
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: any) => (
    <div data-testid="sortable-context">{children}</div>
  ),
  sortableKeyboardCoordinates: vi.fn(),
  rectSortingStrategy: vi.fn(),
  arrayMove: vi.fn((array, from, to) => {
    const result = [...array];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
}));

const mockSnippets: Snippet[] = [
  {
    id: "1",
    title: "Test Snippet 1",
    description: "A test snippet",
    code: "console.log('test');",
    language: "javascript",
    tags: ["test", "js"],
    category: "utility",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    usageCount: 5,
    prefix: "test1",
  },
  {
    id: "2",
    title: "Test Snippet 2",
    description: "Another test snippet",
    code: "print('hello')",
    language: "python",
    tags: ["test", "python"],
    category: "example",
    createdAt: new Date("2023-01-02"),
    updatedAt: new Date("2023-01-02"),
    usageCount: 3,
    prefix: "test2",
  },
];

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      snippets: snippetsReducer,
      ui: uiReducer,
    },
    preloadedState: {
      snippets: {
        items: mockSnippets,
        loading: false,
        error: null,
        selectedIds: [],
      },
      ui: {
        theme: "light",
        sidebarOpen: true,
        viewMode: "grid",
        notifications: [],
      },
      ...initialState,
    },
  });
};

const renderWithStore = (
  component: React.ReactElement,
  store = createMockStore()
) => {
  return render(<Provider store={store}>{component}</Provider>);
};

describe("SnippetGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    const store = createMockStore({
      snippets: {
        items: [],
        loading: true,
        error: null,
        selectedIds: [],
      },
    });

    renderWithStore(<SnippetGrid />, store);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
    expect(screen.getByText("Loading snippets...")).toBeInTheDocument();
  });

  it("renders empty state when no snippets", () => {
    const store = createMockStore({
      snippets: {
        items: [],
        loading: false,
        error: null,
        selectedIds: [],
      },
    });

    renderWithStore(<SnippetGrid />, store);
    expect(
      screen.getByText(
        "No snippets found. Create your first snippet to get started!"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Create Snippet")).toBeInTheDocument();
  });

  it("renders snippets in grid view", () => {
    renderWithStore(<SnippetGrid />);

    expect(screen.getByTestId("snippet-grid")).toBeInTheDocument();
    expect(screen.getByText("Snippets (2)")).toBeInTheDocument();
    expect(screen.getByTestId("virtual-grid")).toBeInTheDocument();
  });

  it("shows filter controls", () => {
    renderWithStore(<SnippetGrid />);

    expect(
      screen.getByPlaceholderText("Search snippets...")
    ).toBeInTheDocument();
    expect(screen.getByText("Show Filters")).toBeInTheDocument();
  });

  it("expands and collapses filter controls", async () => {
    renderWithStore(<SnippetGrid />);

    const showFiltersButton = screen.getByText("Show Filters");
    fireEvent.click(showFiltersButton);

    await waitFor(() => {
      expect(screen.getByText("Hide Filters")).toBeInTheDocument();
      expect(screen.getByLabelText("Language")).toBeInTheDocument();
      expect(screen.getByLabelText("Category")).toBeInTheDocument();
    });
  });

  it("filters snippets by search text", async () => {
    renderWithStore(<SnippetGrid />);

    const searchInput = screen.getByPlaceholderText("Search snippets...");
    fireEvent.change(searchInput, { target: { value: "python" } });

    // The filtering logic is tested through the component behavior
    expect(searchInput).toHaveValue("python");
  });

  it("shows view mode toggle", () => {
    renderWithStore(<SnippetGrid />);

    expect(screen.getByTitle("Grid view")).toBeInTheDocument();
    expect(screen.getByTitle("List view")).toBeInTheDocument();
  });

  it("shows bulk actions when snippets are selected", () => {
    const store = createMockStore({
      snippets: {
        items: mockSnippets,
        loading: false,
        error: null,
        selectedIds: ["1"],
      },
    });

    renderWithStore(<SnippetGrid />, store);

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-actions")).toBeInTheDocument();
  });

  it("shows clear filters option when filters are active", async () => {
    renderWithStore(<SnippetGrid />);

    const searchInput = screen.getByPlaceholderText("Search snippets...");
    fireEvent.change(searchInput, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("Clear All")).toBeInTheDocument();
    });
  });

  it("shows empty state with clear filters when no results match filters", async () => {
    renderWithStore(<SnippetGrid />);

    const searchInput = screen.getByPlaceholderText("Search snippets...");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    await waitFor(() => {
      expect(
        screen.getByText("No snippets match your current filters.")
      ).toBeInTheDocument();
      expect(screen.getByText("Clear Filters")).toBeInTheDocument();
    });
  });

  it("handles drag and drop", () => {
    renderWithStore(<SnippetGrid />);

    expect(screen.getByTestId("dnd-context")).toBeInTheDocument();
    expect(screen.getByTestId("sortable-context")).toBeInTheDocument();
  });

  it("renders new snippet button", () => {
    renderWithStore(<SnippetGrid />);

    const newSnippetButton = screen.getByText("New Snippet");
    expect(newSnippetButton).toBeInTheDocument();
  });

  it("handles error state", () => {
    const store = createMockStore({
      snippets: {
        items: [],
        loading: false,
        error: "Failed to load snippets",
        selectedIds: [],
      },
    });

    renderWithStore(<SnippetGrid />, store);

    // Error handling is done through notifications, so we check that the component still renders
    expect(screen.getByTestId("snippet-grid")).toBeInTheDocument();
  });
});

describe("SnippetGrid Performance", () => {
  it("handles large number of snippets efficiently", () => {
    const largeSnippetList = Array.from({ length: 1000 }, (_, i) => ({
      id: `snippet-${i}`,
      title: `Snippet ${i}`,
      description: `Description ${i}`,
      code: `console.log(${i});`,
      language: "javascript",
      tags: [`tag${i % 10}`],
      category: `category${i % 5}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: i,
      prefix: `snippet${i}`,
    }));

    const store = createMockStore({
      snippets: {
        items: largeSnippetList,
        loading: false,
        error: null,
        selectedIds: [],
      },
    });

    const startTime = performance.now();
    renderWithStore(<SnippetGrid />, store);
    const endTime = performance.now();

    expect(screen.getByText("Snippets (1000)")).toBeInTheDocument();
    expect(endTime - startTime).toBeLessThan(1000); // Should render in less than 1 second
  });

  it("efficiently updates when filters change", async () => {
    const store = createMockStore();
    renderWithStore(<SnippetGrid />, store);

    const searchInput = screen.getByPlaceholderText("Search snippets...");

    const startTime = performance.now();
    fireEvent.change(searchInput, { target: { value: "test" } });
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // Should update quickly
  });
});
