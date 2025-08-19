import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import "@testing-library/jest-dom";
import Layout from "../Layout";
import uiReducer from "../../../store/slices/uiSlice";

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

const renderWithStore = (ui: React.ReactElement, store = createTestStore()) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>{ui}</BrowserRouter>
    </Provider>
  );
};

describe("Layout", () => {
  it("renders children correctly", () => {
    renderWithStore(
      <Layout>
        <div data-testid="test-child">Test Content</div>
      </Layout>
    );

    expect(screen.getByTestId("test-child")).toBeInTheDocument();
  });

  it("applies light theme class by default", () => {
    renderWithStore(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByTestId("layout")).toHaveClass("light");
  });

  it("applies dark theme class when theme is dark", () => {
    const store = createTestStore({ theme: "dark" });
    renderWithStore(
      <Layout>
        <div>Content</div>
      </Layout>,
      store
    );

    expect(screen.getByTestId("layout")).toHaveClass("dark");
  });

  it("toggles sidebar when toggle button is clicked", () => {
    const store = createTestStore();
    renderWithStore(
      <Layout>
        <div>Content</div>
      </Layout>,
      store
    );

    const toggleButton = screen.getByTestId("sidebar-toggle");
    fireEvent.click(toggleButton);

    // Check if the action was dispatched by checking the store state
    const state = store.getState();
    expect(state.ui.sidebarOpen).toBe(false);
  });

  it("shows sidebar as open when sidebarOpen is true", () => {
    const store = createTestStore({ sidebarOpen: true });
    renderWithStore(
      <Layout>
        <div>Content</div>
      </Layout>,
      store
    );

    const mainContent = screen.getByRole("main");
    expect(mainContent).toHaveClass("sidebar-open");
  });

  it("shows sidebar as closed when sidebarOpen is false", () => {
    const store = createTestStore({ sidebarOpen: false });
    renderWithStore(
      <Layout>
        <div>Content</div>
      </Layout>,
      store
    );

    const mainContent = screen.getByRole("main");
    expect(mainContent).toHaveClass("sidebar-closed");
  });
});
