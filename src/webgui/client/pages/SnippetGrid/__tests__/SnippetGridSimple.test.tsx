import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { vi, describe, it, expect } from "vitest";
import SnippetGrid from "../SnippetGrid";
import snippetsReducer from "../../../store/slices/snippetsSlice";
import uiReducer from "../../../store/slices/uiSlice";
import { Snippet } from "../../../../types";

// Mock all external dependencies
vi.mock("react-window", () => ({
  FixedSizeGrid: ({ children }: any) => (
    <div data-testid="virtual-grid">Mocked Grid</div>
  ),
}));

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: any) => <pre>{children}</pre>,
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  vscDarkPlus: {},
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  rectSortingStrategy: vi.fn(),
  arrayMove: vi.fn(),
}));

vi.mock("../../services/api", () => ({
  snippetAPI: {
    getAll: vi.fn(() => Promise.resolve([])),
  },
}));

const mockSnippets: Snippet[] = [
  {
    id: "1",
    title: "Test Snippet",
    description: "A test snippet",
    code: "console.log('test');",
    language: "javascript",
    tags: ["test"],
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 0,
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
        items: [],
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

describe("SnippetGrid Basic Functionality", () => {
  it("renders loading state", () => {
    const store = createMockStore({
      snippets: {
        items: [],
        loading: true,
        error: null,
        selectedIds: [],
      },
    });

    render(
      <Provider store={store}>
        <SnippetGrid />
      </Provider>
    );

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("renders with snippets", () => {
    const store = createMockStore({
      snippets: {
        items: mockSnippets,
        loading: false,
        error: null,
        selectedIds: [],
      },
    });

    render(
      <Provider store={store}>
        <SnippetGrid />
      </Provider>
    );

    expect(screen.getByTestId("snippet-grid")).toBeInTheDocument();
    expect(screen.getByText("Snippets (1)")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    const store = createMockStore({
      snippets: {
        items: [],
        loading: false,
        error: null,
        selectedIds: [],
      },
    });

    render(
      <Provider store={store}>
        <SnippetGrid />
      </Provider>
    );

    expect(screen.getByText(/No snippets found/)).toBeInTheDocument();
  });
});
