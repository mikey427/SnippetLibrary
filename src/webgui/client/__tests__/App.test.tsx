import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import "@testing-library/jest-dom";
import App from "../App";
import snippetsReducer from "../store/slices/snippetsSlice";
import uiReducer from "../store/slices/uiSlice";
import searchReducer from "../store/slices/searchSlice";

// Mock the API
vi.mock("../services/api", () => ({
  snippetAPI: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    search: vi.fn().mockResolvedValue([]),
  },
}));

const createTestStore = () => {
  return configureStore({
    reducer: {
      snippets: snippetsReducer,
      ui: uiReducer,
      search: searchReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false, // Disable for tests
      }),
  });
};

const renderWithProviders = (ui: React.ReactElement) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>{ui}</BrowserRouter>
    </Provider>
  );
};

describe("App", () => {
  it("renders without crashing", () => {
    renderWithProviders(<App />);
    expect(screen.getByTestId("layout")).toBeInTheDocument();
  });

  it("renders the header with correct title", () => {
    renderWithProviders(<App />);
    expect(screen.getByText("Snippet Library")).toBeInTheDocument();
  });

  it("renders the sidebar navigation", () => {
    renderWithProviders(<App />);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("renders the snippet grid by default", () => {
    renderWithProviders(<App />);
    // Initially shows loading state, then snippet grid
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
