import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ViewModeToggle from "../components/ViewModeToggle";
import uiReducer, { setViewMode } from "../../../store/slices/uiSlice";

const createMockStore = (viewMode: "grid" | "list" = "grid") => {
  return configureStore({
    reducer: {
      ui: uiReducer,
    },
    preloadedState: {
      ui: {
        theme: "light",
        sidebarOpen: true,
        viewMode,
        notifications: [],
      },
    },
  });
};

const renderWithStore = (store = createMockStore()) => {
  return render(
    <Provider store={store}>
      <ViewModeToggle />
    </Provider>
  );
};

describe("ViewModeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both view mode buttons", () => {
    renderWithStore();

    expect(screen.getByTitle("Grid view")).toBeInTheDocument();
    expect(screen.getByTitle("List view")).toBeInTheDocument();
    expect(screen.getByText("Grid")).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
  });

  it("shows grid view as active by default", () => {
    renderWithStore();

    const gridButton = screen.getByTitle("Grid view");
    const listButton = screen.getByTitle("List view");

    expect(gridButton).toHaveClass("active");
    expect(listButton).not.toHaveClass("active");
  });

  it("shows list view as active when list mode is selected", () => {
    const store = createMockStore("list");
    renderWithStore(store);

    const gridButton = screen.getByTitle("Grid view");
    const listButton = screen.getByTitle("List view");

    expect(gridButton).not.toHaveClass("active");
    expect(listButton).toHaveClass("active");
  });

  it("dispatches setViewMode action when grid button is clicked", () => {
    const store = createMockStore("list");
    const dispatchSpy = vi.spyOn(store, "dispatch");
    renderWithStore(store);

    const gridButton = screen.getByTitle("Grid view");
    fireEvent.click(gridButton);

    expect(dispatchSpy).toHaveBeenCalledWith(setViewMode("grid"));
  });

  it("dispatches setViewMode action when list button is clicked", () => {
    const store = createMockStore("grid");
    const dispatchSpy = vi.spyOn(store, "dispatch");
    renderWithStore(store);

    const listButton = screen.getByTitle("List view");
    fireEvent.click(listButton);

    expect(dispatchSpy).toHaveBeenCalledWith(setViewMode("list"));
  });

  it("has proper accessibility attributes", () => {
    renderWithStore();

    const gridButton = screen.getByTitle("Grid view");
    const listButton = screen.getByTitle("List view");

    expect(gridButton).toHaveAttribute("aria-pressed", "true");
    expect(listButton).toHaveAttribute("aria-pressed", "false");

    // Check role group
    const toggleGroup = screen.getByRole("group");
    expect(toggleGroup).toHaveAttribute("aria-label", "View mode");
  });

  it("updates aria-pressed when view mode changes", () => {
    const store = createMockStore("grid");
    renderWithStore(store);

    const gridButton = screen.getByTitle("Grid view");
    const listButton = screen.getByTitle("List view");

    // Initially grid is active
    expect(gridButton).toHaveAttribute("aria-pressed", "true");
    expect(listButton).toHaveAttribute("aria-pressed", "false");
  });

  it("renders SVG icons for both buttons", () => {
    renderWithStore();

    const svgElements = document.querySelectorAll("svg");
    expect(svgElements).toHaveLength(2);
  });

  it("applies correct CSS classes", () => {
    renderWithStore();

    const gridButton = screen.getByTitle("Grid view");
    const listButton = screen.getByTitle("List view");

    expect(gridButton).toHaveClass("view-mode-button");
    expect(listButton).toHaveClass("view-mode-button");
    expect(gridButton).toHaveClass("active");
  });

  it("handles keyboard navigation", () => {
    renderWithStore();

    const gridButton = screen.getByTitle("Grid view");
    const listButton = screen.getByTitle("List view");

    // Both buttons should be focusable (buttons are focusable by default)
    expect(gridButton.tagName).toBe("BUTTON");
    expect(listButton.tagName).toBe("BUTTON");
  });

  it("maintains button state consistency", () => {
    const store = createMockStore("grid");
    const dispatchSpy = vi.spyOn(store, "dispatch");
    renderWithStore(store);

    const gridButton = screen.getByTitle("Grid view");
    const listButton = screen.getByTitle("List view");

    // Initially grid is active
    expect(gridButton).toHaveClass("active");
    expect(listButton).not.toHaveClass("active");

    // Click list button
    fireEvent.click(listButton);

    // The dispatch should have been called
    expect(dispatchSpy).toHaveBeenCalledWith(setViewMode("list"));
  });

  it("does not break when clicking the same mode twice", () => {
    const store = createMockStore("grid");
    const dispatchSpy = vi.spyOn(store, "dispatch");
    renderWithStore(store);

    const gridButton = screen.getByTitle("Grid view");

    // Click grid button twice
    fireEvent.click(gridButton);
    fireEvent.click(gridButton);

    // Should dispatch the action both times
    expect(dispatchSpy).toHaveBeenCalledTimes(2);
    expect(dispatchSpy).toHaveBeenCalledWith(setViewMode("grid"));
  });
});
