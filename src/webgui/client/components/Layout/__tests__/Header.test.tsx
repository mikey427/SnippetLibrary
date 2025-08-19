import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import "@testing-library/jest-dom";
import Header from "../Header";
import uiReducer from "../../../store/slices/uiSlice";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { beforeEach } from "node:test";
import { describe } from "node:test";

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      ui: uiReducer,
    },
    preloadedState: {
      ui: {
        theme: "light",
        sidebarOpen: true,
        viewMode: "grid",
        notifications: [],
        ...initialState,
      },
    },
  });
};

const renderWithProviders = (
  ui: React.ReactElement,
  store = createTestStore()
) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>{ui}</BrowserRouter>
    </Provider>
  );
};

describe("Header", () => {
  const mockToggleSidebar = vi.fn();

  beforeEach(() => {
    mockToggleSidebar.mockClear();
  });

  it("renders the header with title", () => {
    renderWithProviders(<Header onToggleSidebar={mockToggleSidebar} />);

    expect(screen.getByText("Snippet Library")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("calls onToggleSidebar when sidebar toggle is clicked", () => {
    renderWithProviders(<Header onToggleSidebar={mockToggleSidebar} />);

    const toggleButton = screen.getByTestId("sidebar-toggle");
    fireEvent.click(toggleButton);

    expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("toggles theme when theme button is clicked", () => {
    const store = createTestStore({ theme: "light" });
    renderWithProviders(<Header onToggleSidebar={mockToggleSidebar} />, store);

    const themeButton = screen.getByTestId("theme-toggle");
    fireEvent.click(themeButton);

    const state = store.getState();
    expect(state.ui.theme).toBe("dark");
  });

  it("toggles view mode when view mode button is clicked", () => {
    const store = createTestStore({ viewMode: "grid" });
    renderWithProviders(<Header onToggleSidebar={mockToggleSidebar} />, store);

    const viewModeButton = screen.getByTestId("view-mode-toggle");
    fireEvent.click(viewModeButton);

    const state = store.getState();
    expect(state.ui.viewMode).toBe("list");
  });

  it("displays correct theme icon for light theme", () => {
    const store = createTestStore({ theme: "light" });
    renderWithProviders(<Header onToggleSidebar={mockToggleSidebar} />, store);

    const themeButton = screen.getByTestId("theme-toggle");
    expect(themeButton).toHaveTextContent("🌙");
  });

  it("displays correct theme icon for dark theme", () => {
    const store = createTestStore({ theme: "dark" });
    renderWithProviders(<Header onToggleSidebar={mockToggleSidebar} />, store);

    const themeButton = screen.getByTestId("theme-toggle");
    expect(themeButton).toHaveTextContent("☀️");
  });

  it("displays correct view mode icon for grid view", () => {
    const store = createTestStore({ viewMode: "grid" });
    renderWithProviders(<Header onToggleSidebar={mockToggleSidebar} />, store);

    const viewModeButton = screen.getByTestId("view-mode-toggle");
    expect(viewModeButton).toHaveTextContent("☰");
  });

  it("displays correct view mode icon for list view", () => {
    const store = createTestStore({ viewMode: "list" });
    renderWithProviders(<Header onToggleSidebar={mockToggleSidebar} />, store);

    const viewModeButton = screen.getByTestId("view-mode-toggle");
    expect(viewModeButton).toHaveTextContent("⊞");
  });
});
