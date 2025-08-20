import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import App from "../../App";
import { snippetsSlice } from "../../store/slices/snippetsSlice";
import { uiSlice } from "../../store/slices/uiSlice";
import { Snippet } from "../../../../core/models/Snippet";

/**
 * End-to-end tests for Web GUI user journeys
 * Tests complete user workflows from UI interaction to data persistence
 */
describe("Web GUI End-to-End User Journeys", () => {
  let store: any;
  let user: any;

  const mockSnippets = [
    new Snippet({
      id: "1",
      title: "React Component",
      description: "Basic React functional component",
      code: "import React from 'react';\n\nconst Component = () => {\n  return <div>Hello World</div>;\n};\n\nexport default Component;",
      language: "typescript",
      tags: ["react", "component", "typescript"],
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      usageCount: 5,
    }),
    new Snippet({
      id: "2",
      title: "Express Route",
      description: "Express.js route handler",
      code: "app.get('/api/users', async (req, res) => {\n  try {\n    const users = await User.find();\n    res.json(users);\n  } catch (error) {\n    res.status(500).json({ error: error.message });\n  }\n});",
      language: "javascript",
      tags: ["express", "api", "nodejs"],
      createdAt: new Date("2024-01-02"),
      updatedAt: new Date("2024-01-02"),
      usageCount: 3,
    }),
    new Snippet({
      id: "3",
      title: "SQL Query",
      description: "Complex JOIN query",
      code: "SELECT u.name, p.title, c.name as category\nFROM users u\nJOIN posts p ON u.id = p.user_id\nJOIN categories c ON p.category_id = c.id\nWHERE u.active = 1\nORDER BY p.created_at DESC;",
      language: "sql",
      tags: ["sql", "database", "join"],
      createdAt: new Date("2024-01-03"),
      updatedAt: new Date("2024-01-03"),
      usageCount: 1,
    }),
  ];

  // Mock API calls
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    user = userEvent.setup();

    store = configureStore({
      reducer: {
        snippets: snippetsSlice.reducer,
        ui: uiSlice.reducer,
      },
      preloadedState: {
        snippets: {
          items: mockSnippets,
          loading: false,
          error: null,
          searchQuery: "",
          filters: {
            language: "",
            tags: [],
            category: "",
          },
          selectedIds: [],
        },
        ui: {
          theme: "light",
          viewMode: "grid",
          sidebarOpen: true,
          notifications: [],
        },
      },
    });

    // Setup default fetch responses
    mockFetch.mockImplementation((url: string, options?: any) => {
      if (url.includes("/api/snippets") && options?.method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSnippets),
        });
      }
      if (url.includes("/api/snippets") && options?.method === "POST") {
        const newSnippet = { ...JSON.parse(options.body), id: "new-id" };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(newSnippet),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderApp = () => {
    return render(
      <Provider store={store}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Provider>
    );
  };

  describe("Complete Snippet Creation Journey", () => {
    it("should create a new snippet from start to finish", async () => {
      renderApp();

      // Navigate to create snippet
      const createButton = screen.getByRole("button", {
        name: /create snippet/i,
      });
      await user.click(createButton);

      // Fill out the form
      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      const codeEditor = screen.getByRole("textbox", { name: /code/i });
      const languageSelect = screen.getByLabelText(/language/i);
      const tagsInput = screen.getByLabelText(/tags/i);

      await user.type(titleInput, "New Test Snippet");
      await user.type(descriptionInput, "A test snippet for e2e testing");
      await user.type(codeEditor, "console.log('Hello, World!');");
      await user.selectOptions(languageSelect, "javascript");
      await user.type(tagsInput, "test,example");

      // Submit the form
      const saveButton = screen.getByRole("button", { name: /save snippet/i });
      await user.click(saveButton);

      // Verify API call was made
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/snippets",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: expect.stringContaining("New Test Snippet"),
          })
        );
      });

      // Verify success message
      expect(
        screen.getByText(/snippet created successfully/i)
      ).toBeInTheDocument();

      // Verify redirect to snippet list
      await waitFor(() => {
        expect(screen.getByText("React Component")).toBeInTheDocument();
      });
    });

    it("should handle form validation errors", async () => {
      renderApp();

      const createButton = screen.getByRole("button", {
        name: /create snippet/i,
      });
      await user.click(createButton);

      // Try to submit without required fields
      const saveButton = screen.getByRole("button", { name: /save snippet/i });
      await user.click(saveButton);

      // Verify validation errors
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/code is required/i)).toBeInTheDocument();
    });
  });

  describe("Search and Filter Journey", () => {
    it("should search and filter snippets effectively", async () => {
      renderApp();

      // Initial state - all snippets visible
      expect(screen.getByText("React Component")).toBeInTheDocument();
      expect(screen.getByText("Express Route")).toBeInTheDocument();
      expect(screen.getByText("SQL Query")).toBeInTheDocument();

      // Search by text
      const searchInput = screen.getByPlaceholderText(/search snippets/i);
      await user.type(searchInput, "react");

      await waitFor(() => {
        expect(screen.getByText("React Component")).toBeInTheDocument();
        expect(screen.queryByText("Express Route")).not.toBeInTheDocument();
        expect(screen.queryByText("SQL Query")).not.toBeInTheDocument();
      });

      // Clear search and filter by language
      await user.clear(searchInput);

      const languageFilter = screen.getByLabelText(/filter by language/i);
      await user.selectOptions(languageFilter, "javascript");

      await waitFor(() => {
        expect(screen.queryByText("React Component")).not.toBeInTheDocument();
        expect(screen.getByText("Express Route")).toBeInTheDocument();
        expect(screen.queryByText("SQL Query")).not.toBeInTheDocument();
      });

      // Filter by tags
      const tagFilter = screen.getByLabelText(/filter by tags/i);
      await user.type(tagFilter, "api");

      await waitFor(() => {
        expect(screen.getByText("Express Route")).toBeInTheDocument();
      });
    });

    it("should handle advanced search with multiple criteria", async () => {
      renderApp();

      // Open advanced search
      const advancedSearchButton = screen.getByRole("button", {
        name: /advanced search/i,
      });
      await user.click(advancedSearchButton);

      // Set multiple filters
      const languageSelect = screen.getByLabelText(/language/i);
      const tagsInput = screen.getByLabelText(/tags/i);
      const dateFromInput = screen.getByLabelText(/created from/i);

      await user.selectOptions(languageSelect, "typescript");
      await user.type(tagsInput, "react");
      await user.type(dateFromInput, "2024-01-01");

      const applyFiltersButton = screen.getByRole("button", {
        name: /apply filters/i,
      });
      await user.click(applyFiltersButton);

      await waitFor(() => {
        expect(screen.getByText("React Component")).toBeInTheDocument();
        expect(screen.queryByText("Express Route")).not.toBeInTheDocument();
        expect(screen.queryByText("SQL Query")).not.toBeInTheDocument();
      });
    });
  });

  describe("Bulk Operations Journey", () => {
    it("should perform bulk operations on multiple snippets", async () => {
      renderApp();

      // Enter selection mode
      const selectModeButton = screen.getByRole("button", {
        name: /select mode/i,
      });
      await user.click(selectModeButton);

      // Select multiple snippets
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]); // React Component
      await user.click(checkboxes[1]); // Express Route

      // Verify selection count
      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();

      // Perform bulk tag operation
      const bulkTagButton = screen.getByRole("button", { name: /bulk tag/i });
      await user.click(bulkTagButton);

      const tagInput = screen.getByLabelText(/add tags/i);
      await user.type(tagInput, "production,tested");

      const applyTagsButton = screen.getByRole("button", {
        name: /apply tags/i,
      });
      await user.click(applyTagsButton);

      // Verify API calls for bulk update
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/snippets/1",
          expect.objectContaining({ method: "PUT" })
        );
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/snippets/2",
          expect.objectContaining({ method: "PUT" })
        );
      });

      // Verify success message
      expect(
        screen.getByText(/2 snippets updated successfully/i)
      ).toBeInTheDocument();
    });

    it("should handle bulk delete with confirmation", async () => {
      renderApp();

      // Enter selection mode and select snippets
      const selectModeButton = screen.getByRole("button", {
        name: /select mode/i,
      });
      await user.click(selectModeButton);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // Perform bulk delete
      const bulkDeleteButton = screen.getByRole("button", {
        name: /bulk delete/i,
      });
      await user.click(bulkDeleteButton);

      // Confirm deletion
      const confirmDialog = screen.getByRole("dialog");
      const confirmButton = within(confirmDialog).getByRole("button", {
        name: /confirm/i,
      });
      await user.click(confirmButton);

      // Verify API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/snippets/1",
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });
  });

  describe("Import/Export Journey", () => {
    it("should export snippets with selected format", async () => {
      renderApp();

      // Navigate to import/export
      const menuButton = screen.getByRole("button", { name: /menu/i });
      await user.click(menuButton);

      const importExportLink = screen.getByRole("link", {
        name: /import\/export/i,
      });
      await user.click(importExportLink);

      // Select export format
      const formatSelect = screen.getByLabelText(/export format/i);
      await user.selectOptions(formatSelect, "json");

      // Select snippets to export
      const selectAllCheckbox = screen.getByLabelText(/select all/i);
      await user.click(selectAllCheckbox);

      // Export
      const exportButton = screen.getByRole("button", {
        name: /export selected/i,
      });
      await user.click(exportButton);

      // Verify download was triggered
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/snippets/export",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("json"),
          })
        );
      });
    });

    it("should import snippets with conflict resolution", async () => {
      renderApp();

      // Navigate to import/export
      const menuButton = screen.getByRole("button", { name: /menu/i });
      await user.click(menuButton);

      const importExportLink = screen.getByRole("link", {
        name: /import\/export/i,
      });
      await user.click(importExportLink);

      // Mock file input
      const fileInput = screen.getByLabelText(/select file/i);
      const file = new File(['{"snippets": []}'], "snippets.json", {
        type: "application/json",
      });

      await user.upload(fileInput, file);

      // Set conflict resolution strategy
      const conflictSelect = screen.getByLabelText(/conflict resolution/i);
      await user.selectOptions(conflictSelect, "merge");

      // Import
      const importButton = screen.getByRole("button", {
        name: /import snippets/i,
      });
      await user.click(importButton);

      // Verify API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/snippets/import",
          expect.objectContaining({
            method: "POST",
          })
        );
      });

      // Verify success message
      expect(
        screen.getByText(/snippets imported successfully/i)
      ).toBeInTheDocument();
    });
  });

  describe("Snippet Editing Journey", () => {
    it("should edit existing snippet with live preview", async () => {
      renderApp();

      // Click on a snippet to edit
      const snippetCard = screen.getByText("React Component");
      await user.click(snippetCard);

      // Verify we're in edit mode
      expect(screen.getByDisplayValue("React Component")).toBeInTheDocument();

      // Edit the snippet
      const titleInput = screen.getByDisplayValue("React Component");
      await user.clear(titleInput);
      await user.type(titleInput, "Updated React Component");

      const codeEditor = screen.getByDisplayValue(/import React/);
      await user.type(codeEditor, "\n// Updated component");

      // Verify live preview updates
      const preview = screen.getByTestId("code-preview");
      expect(preview).toHaveTextContent("Updated component");

      // Save changes
      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      // Verify API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/snippets/1",
          expect.objectContaining({
            method: "PUT",
            body: expect.stringContaining("Updated React Component"),
          })
        );
      });

      // Verify success message and navigation
      expect(
        screen.getByText(/snippet updated successfully/i)
      ).toBeInTheDocument();
    });
  });

  describe("Real-time Synchronization Journey", () => {
    it("should handle real-time updates from VS Code extension", async () => {
      renderApp();

      // Mock WebSocket connection
      const mockWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      // Simulate receiving real-time update
      const wsMessageHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call) => call[0] === "message"
      )?.[1];

      if (wsMessageHandler) {
        const updateEvent = {
          data: JSON.stringify({
            type: "snippet_created",
            payload: {
              id: "new-snippet",
              title: "New Snippet from VS Code",
              code: "console.log('from vscode');",
              language: "javascript",
              tags: ["vscode"],
            },
          }),
        };

        wsMessageHandler(updateEvent);
      }

      // Verify UI updates with new snippet
      await waitFor(() => {
        expect(
          screen.getByText("New Snippet from VS Code")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling Journey", () => {
    it("should handle network errors gracefully", async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      renderApp();

      const createButton = screen.getByRole("button", {
        name: /create snippet/i,
      });
      await user.click(createButton);

      // Fill and submit form
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, "Test Snippet");

      const saveButton = screen.getByRole("button", { name: /save snippet/i });
      await user.click(saveButton);

      // Verify error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Verify retry option
      const retryButton = screen.getByRole("button", { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it("should handle validation errors from server", async () => {
      // Mock server validation error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: "Validation failed",
            details: { title: "Title already exists" },
          }),
      });

      renderApp();

      const createButton = screen.getByRole("button", {
        name: /create snippet/i,
      });
      await user.click(createButton);

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, "Duplicate Title");

      const saveButton = screen.getByRole("button", { name: /save snippet/i });
      await user.click(saveButton);

      // Verify server error is displayed
      await waitFor(() => {
        expect(screen.getByText(/title already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe("Performance and User Experience", () => {
    it("should handle large snippet collections efficiently", async () => {
      // Create a large number of snippets
      const largeSnippetCollection = Array.from(
        { length: 1000 },
        (_, i) =>
          new Snippet({
            id: `snippet-${i}`,
            title: `Snippet ${i}`,
            code: `console.log('snippet ${i}');`,
            language: "javascript",
            tags: [`tag${i % 10}`],
          })
      );

      store = configureStore({
        reducer: {
          snippets: snippetsSlice.reducer,
          ui: uiSlice.reducer,
        },
        preloadedState: {
          snippets: {
            items: largeSnippetCollection,
            loading: false,
            error: null,
            searchQuery: "",
            filters: { language: "", tags: [], category: "" },
            selectedIds: [],
          },
          ui: {
            theme: "light",
            viewMode: "grid",
            sidebarOpen: true,
            notifications: [],
          },
        },
      });

      renderApp();

      // Verify virtual scrolling is working (only visible items rendered)
      const snippetCards = screen.getAllByTestId("snippet-card");
      expect(snippetCards.length).toBeLessThan(100); // Should not render all 1000

      // Test search performance
      const searchInput = screen.getByPlaceholderText(/search snippets/i);
      const startTime = performance.now();

      await user.type(searchInput, "snippet 1");

      await waitFor(() => {
        const endTime = performance.now();
        expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
        expect(screen.getByText("Snippet 1")).toBeInTheDocument();
      });
    });
  });
});
