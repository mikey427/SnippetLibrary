import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import BulkActions from "../components/BulkActions";
import snippetsReducer from "../../../store/slices/snippetsSlice";
import uiReducer from "../../../store/slices/uiSlice";
import { Snippet } from "../../../../types";

// Mock window.confirm
const mockConfirm = vi.fn();
Object.defineProperty(global, "window", {
  value: { confirm: mockConfirm },
  writable: true,
});

// Mock API calls
vi.mock("../../../services/api", () => ({
  snippetAPI: {
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

const createLargeSnippetSet = (count: number): Snippet[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `snippet-${i}`,
    title: `Test Snippet ${i}`,
    description: `Description for snippet ${i}`,
    code: `console.log('snippet ${i}');`,
    language: i % 2 === 0 ? "javascript" : "typescript",
    tags: [`tag-${i % 5}`, `category-${i % 3}`],
    category: `category-${i % 4}`,
    createdAt: new Date(2023, 0, i + 1),
    updatedAt: new Date(2023, 0, i + 1),
    usageCount: i,
  }));
};

const createMockStore = (snippetCount = 100) => {
  const snippets = createLargeSnippetSet(snippetCount);
  return configureStore({
    reducer: {
      snippets: snippetsReducer,
      ui: uiReducer,
    },
    preloadedState: {
      snippets: {
        items: snippets,
        loading: false,
        error: null,
        selectedIds: snippets.slice(0, 10).map((s) => s.id), // Select first 10
      },
      ui: {
        theme: "light",
        sidebarOpen: true,
        viewMode: "grid",
        notifications: [],
      },
    },
  });
};

const renderWithStore = (props: any, store = createMockStore()) => {
  return render(
    <Provider store={store}>
      <BulkActions {...props} />
    </Provider>
  );
};

describe("BulkOperations - Advanced Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Performance with Large Datasets", () => {
    it("handles bulk operations on large selection efficiently", async () => {
      const store = createMockStore(1000);
      const selectedIds = Array.from({ length: 100 }, (_, i) => `snippet-${i}`);
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      const startTime = performance.now();
      renderWithStore(props, store);
      const renderTime = performance.now() - startTime;

      // Should render quickly even with large datasets
      expect(renderTime).toBeLessThan(100); // 100ms threshold
      expect(screen.getByText("100 snippets selected")).toBeInTheDocument();
    });

    it("shows progress updates during bulk operations", async () => {
      const selectedIds = Array.from({ length: 50 }, (_, i) => `snippet-${i}`);
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const deleteButton = screen.getByText("Delete Selected");
      fireEvent.click(deleteButton);

      // Should show progress indicator
      await waitFor(() => {
        expect(screen.getByText(/Processing:/)).toBeInTheDocument();
      });

      // Should show progress stats
      await waitFor(() => {
        expect(screen.getByText(/\d+ \/ 50/)).toBeInTheDocument();
      });
    });

    it("allows cancellation of long-running operations", async () => {
      const selectedIds = Array.from({ length: 100 }, (_, i) => `snippet-${i}`);
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const tagInput = screen.getByLabelText("Tags (comma-separated):");
      fireEvent.change(tagInput, { target: { value: "test-tag" } });

      const applyButton = screen.getByText("Apply Changes");
      fireEvent.click(applyButton);

      // Should be able to cancel
      const cancelButton = screen.getByText("Cancel");
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).not.toBeDisabled();
    });
  });

  describe("Error Handling and Recovery", () => {
    it("handles partial failures gracefully", async () => {
      const { snippetAPI } = await import("../../../services/api");

      // Mock some operations to fail
      (snippetAPI.delete as any).mockImplementation((id: string) => {
        if (id.includes("1") || id.includes("3")) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve();
      });

      const selectedIds = ["snippet-0", "snippet-1", "snippet-2", "snippet-3"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const deleteButton = screen.getByText("Delete Selected");
      fireEvent.click(deleteButton);

      // Should show error count in progress
      await waitFor(() => {
        expect(screen.getByText(/failed/)).toBeInTheDocument();
      });
    });

    it("provides detailed error messages", async () => {
      const { snippetAPI } = await import("../../../services/api");

      (snippetAPI.update as any).mockRejectedValue(
        new Error("Validation failed")
      );

      const selectedIds = ["snippet-0", "snippet-1"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      const store = createMockStore();
      const dispatchSpy = vi.spyOn(store, "dispatch");

      renderWithStore(props, store);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const tagInput = screen.getByLabelText("Tags (comma-separated):");
      fireEvent.change(tagInput, { target: { value: "test-tag" } });

      const applyButton = screen.getByText("Apply Changes");
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "ui/addNotification",
            payload: expect.objectContaining({
              type: "error",
              message: expect.stringContaining("Failed to update"),
            }),
          })
        );
      });
    });

    it("allows retry of failed operations", async () => {
      const selectedIds = ["snippet-0", "snippet-1"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      // First attempt fails
      const deleteButton = screen.getByText("Delete Selected");
      fireEvent.click(deleteButton);

      // Should be able to try again after failure
      await waitFor(() => {
        expect(screen.getByText("Delete Selected")).not.toBeDisabled();
      });
    });

    it("maintains UI responsiveness during operations", async () => {
      const selectedIds = Array.from({ length: 50 }, (_, i) => `snippet-${i}`);
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const deleteButton = screen.getByText("Delete Selected");
      fireEvent.click(deleteButton);

      // UI should remain responsive
      const clearButton = screen.getByText("Clear Selection");
      expect(clearButton).toBeInTheDocument();

      // Other buttons should be disabled but present
      expect(screen.getByText("Bulk Edit")).toBeDisabled();
      expect(screen.getByText("Export Selected")).toBeDisabled();
    });
  });

  describe("Advanced Bulk Edit Features", () => {
    it("handles complex tag operations correctly", () => {
      const selectedIds = ["snippet-0", "snippet-1"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      // Test replace operation
      const replaceRadio = screen.getByLabelText("Replace all tags");
      fireEvent.click(replaceRadio);

      const tagInput = screen.getByLabelText("Tags (comma-separated):");
      fireEvent.change(tagInput, { target: { value: "new-tag1, new-tag2" } });

      // Should show preview
      expect(screen.getByText("new-tag1")).toBeInTheDocument();
      expect(screen.getByText("new-tag2")).toBeInTheDocument();
    });

    it("validates form inputs before submission", () => {
      const selectedIds = ["snippet-0"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      // Submit without any changes
      const applyButton = screen.getByText("Apply Changes");
      fireEvent.click(applyButton);

      // Should show validation error
      expect(
        screen.getByText(/specify at least one field/)
      ).toBeInTheDocument();
    });

    it("preserves form state during operations", async () => {
      const selectedIds = ["snippet-0"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const tagInput = screen.getByLabelText("Tags (comma-separated):");
      fireEvent.change(tagInput, { target: { value: "persistent-tag" } });

      const categoryInput = screen.getByLabelText("Category:");
      fireEvent.change(categoryInput, { target: { value: "test-category" } });

      // Values should persist
      expect(tagInput).toHaveValue("persistent-tag");
      expect(categoryInput).toHaveValue("test-category");
    });

    it("provides autocomplete suggestions for categories", () => {
      const selectedIds = ["snippet-0"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const categoryInput = screen.getByLabelText("Category:");
      const datalist = document.getElementById("available-categories");

      expect(categoryInput).toHaveAttribute("list", "available-categories");
      expect(datalist).toBeInTheDocument();

      // Should have options from existing snippets
      const options = datalist?.querySelectorAll("option");
      expect(options?.length).toBeGreaterThan(0);
    });

    it("handles empty category input correctly", () => {
      const selectedIds = ["snippet-0"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const categoryInput = screen.getByLabelText("Category:");

      // Empty value should be allowed (removes category)
      fireEvent.change(categoryInput, { target: { value: "" } });

      const applyButton = screen.getByText("Apply Changes");
      expect(applyButton).not.toBeDisabled();
    });
  });

  describe("Accessibility and Usability", () => {
    it("provides proper ARIA labels and roles", () => {
      const selectedIds = ["snippet-0"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const bulkActions = screen.getByTestId("bulk-actions");
      expect(bulkActions).toBeInTheDocument();

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      // Modal should have proper accessibility
      const modal = screen.getByRole("dialog", { hidden: true });
      expect(modal).toBeInTheDocument();
    });

    it("supports keyboard navigation", () => {
      const selectedIds = ["snippet-0"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const bulkEditButton = screen.getByText("Bulk Edit");

      // Should be focusable
      bulkEditButton.focus();
      expect(document.activeElement).toBe(bulkEditButton);

      // Should respond to Enter key
      fireEvent.keyDown(bulkEditButton, { key: "Enter" });
      expect(screen.getByText("Bulk Edit 3 Snippets")).toBeInTheDocument();
    });

    it("provides clear visual feedback for operations", async () => {
      const selectedIds = ["snippet-0", "snippet-1"];
      const props = {
        selectedIds,
        onClearSelection: vi.fn(),
      };

      renderWithStore(props);

      const deleteButton = screen.getByText("Delete Selected");
      fireEvent.click(deleteButton);

      // Should show loading state
      expect(screen.getByText("Deleting...")).toBeInTheDocument();

      // Should show progress bar
      const progressBar = document.querySelector(".progress-bar");
      expect(progressBar).toBeInTheDocument();
    });
  });
});
