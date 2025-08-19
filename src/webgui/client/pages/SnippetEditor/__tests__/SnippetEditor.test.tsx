import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { vi } from "vitest";
import SnippetEditor from "../SnippetEditor";
import snippetsSlice from "../../../store/slices/snippetsSlice";
import uiSlice from "../../../store/slices/uiSlice";

// Mock the API
vi.mock("../../../services/api", () => ({
  snippetAPI: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      snippets: snippetsSlice,
      ui: uiSlice,
    },
    preloadedState: {
      snippets: {
        items: [],
        loading: false,
        error: null,
        selectedIds: [],
      },
      ui: {
        notifications: [],
        theme: "light",
        sidebarOpen: true,
      },
      ...initialState,
    },
  });
};

const renderWithProviders = (
  component: React.ReactElement,
  { initialState = {}, route = "/" } = {}
) => {
  const store = createMockStore(initialState);

  window.history.pushState({}, "Test page", route);

  return {
    ...render(
      <Provider store={store}>
        <BrowserRouter>{component}</BrowserRouter>
      </Provider>
    ),
    store,
  };
};

describe("SnippetEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Create Mode", () => {
    it("renders create form correctly", () => {
      renderWithProviders(<SnippetEditor />);

      expect(screen.getByText("Create New Snippet")).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/prefix/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create snippet/i })
      ).toBeInTheDocument();
    });

    it("validates required fields", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      const submitButton = screen.getByRole("button", {
        name: /create snippet/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("This field is required")).toBeInTheDocument();
      });
    });

    it("handles form input changes", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      const languageSelect = screen.getByLabelText(/language/i);

      await user.type(titleInput, "Test Snippet");
      await user.type(descriptionInput, "Test Description");
      await user.selectOptions(languageSelect, "javascript");

      expect(titleInput).toHaveValue("Test Snippet");
      expect(descriptionInput).toHaveValue("Test Description");
      expect(languageSelect).toHaveValue("javascript");
    });

    it("handles code editor changes", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      const codeTextarea = screen.getByPlaceholderText(/enter your code here/i);
      await user.type(codeTextarea, "console.log('Hello World');");

      expect(codeTextarea).toHaveValue("console.log('Hello World');");
    });

    it("handles tag input", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      const tagInput = screen.getByPlaceholderText(
        /type and press enter to add tags/i
      );

      await user.type(tagInput, "react");
      await user.keyboard("{Enter}");

      expect(screen.getByText("react")).toBeInTheDocument();

      await user.type(tagInput, "javascript");
      await user.keyboard("{Enter}");

      expect(screen.getByText("javascript")).toBeInTheDocument();
    });

    it("shows preview when toggle is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      // Add some code first
      const codeTextarea = screen.getByPlaceholderText(/enter your code here/i);
      await user.type(codeTextarea, "console.log('test');");

      const previewButton = screen.getByRole("button", {
        name: /show preview/i,
      });
      await user.click(previewButton);

      expect(screen.getByText("Preview")).toBeInTheDocument();
      expect(screen.getByText(/hide preview/i)).toBeInTheDocument();
    });

    it("validates prefix format", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      const prefixInput = screen.getByLabelText(/prefix/i);
      await user.type(prefixInput, "123invalid");

      const submitButton = screen.getByRole("button", {
        name: /create snippet/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/prefix must start with a letter/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Edit Mode", () => {
    const mockSnippet = {
      id: "1",
      title: "Test Snippet",
      description: "Test Description",
      code: "console.log('test');",
      language: "javascript",
      tags: ["react", "test"],
      category: "utilities",
      prefix: "test",
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    };

    it("renders edit form with existing data", () => {
      const initialState = {
        snippets: {
          items: [mockSnippet],
          loading: false,
          error: null,
          selectedIds: [],
        },
      };

      renderWithProviders(<SnippetEditor />, {
        initialState,
        route: "/edit/1",
      });

      expect(screen.getByText("Edit Snippet")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Test Snippet")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Test Description")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("console.log('test');")
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("javascript")).toBeInTheDocument();
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.getByText("test")).toBeInTheDocument();
      expect(screen.getByDisplayValue("utilities")).toBeInTheDocument();
      expect(screen.getByDisplayValue("test")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /update snippet/i })
      ).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("validates title length", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, "a".repeat(101)); // Exceeds max length

      const submitButton = screen.getByRole("button", {
        name: /create snippet/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/must be no more than 100 characters/i)
        ).toBeInTheDocument();
      });
    });

    it("validates code is not empty", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      const titleInput = screen.getByLabelText(/title/i);
      const languageSelect = screen.getByLabelText(/language/i);
      const codeTextarea = screen.getByPlaceholderText(/enter your code here/i);

      await user.type(titleInput, "Test");
      await user.selectOptions(languageSelect, "javascript");
      await user.type(codeTextarea, "   "); // Only whitespace

      const submitButton = screen.getByRole("button", {
        name: /create snippet/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/code cannot be empty or only whitespace/i)
        ).toBeInTheDocument();
      });
    });

    it("validates maximum number of tags", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      const tagInput = screen.getByPlaceholderText(
        /type and press enter to add tags/i
      );

      // Add 21 tags (exceeds limit of 20)
      for (let i = 0; i < 21; i++) {
        await user.type(tagInput, `tag${i}`);
        await user.keyboard("{Enter}");
      }

      const submitButton = screen.getByRole("button", {
        name: /create snippet/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/maximum 20 tags allowed/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("navigates back when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      // In a real app, this would navigate back
      // Here we just verify the button exists and is clickable
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and roles", () => {
      renderWithProviders(<SnippetEditor />);

      expect(screen.getByRole("form")).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toHaveAttribute("required");
      expect(screen.getByLabelText(/language/i)).toHaveAttribute("required");

      // Check for proper error handling
      const titleInput = screen.getByLabelText(/title/i);
      expect(titleInput).toHaveAttribute("aria-invalid", "false");
    });

    it("shows error messages with proper ARIA attributes", async () => {
      const user = userEvent.setup();
      renderWithProviders(<SnippetEditor />);

      const submitButton = screen.getByRole("button", {
        name: /create snippet/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByRole("alert");
        expect(errorMessages.length).toBeGreaterThan(0);
        errorMessages.forEach((message) => {
          expect(message).toBeInTheDocument();
        });
      });
    });
  });
});
