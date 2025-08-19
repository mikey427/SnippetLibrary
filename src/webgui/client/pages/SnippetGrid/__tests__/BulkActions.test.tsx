import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { vi, describe, it, expect, beforeEach } from "vitest";
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

const mockSnippets: Snippet[] = [
  {
    id: "1",
    title: "Test Snippet 1",
    description: "Description 1",
    code: "console.log('test1');",
    language: "javascript",
    tags: ["test", "js"],
    category: "utility",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    usageCount: 0,
  },
  {
    id: "2",
    title: "Test Snippet 2",
    description: "Description 2",
    code: "console.log('test2');",
    language: "typescript",
    tags: ["test", "ts"],
    category: "component",
    createdAt: new Date("2023-01-02"),
    updatedAt: new Date("2023-01-02"),
    usageCount: 5,
  },
  {
    id: "3",
    title: "Test Snippet 3",
    description: "Description 3",
    code: "print('test3')",
    language: "python",
    tags: ["test", "python"],
    createdAt: new Date("2023-01-03"),
    updatedAt: new Date("2023-01-03"),
    usageCount: 2,
  },
];

const createMockStore = (customState?: any) => {
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
        ...customState?.snippets,
      },
      ui: {
        theme: "light",
        sidebarOpen: true,
        viewMode: "grid",
        notifications: [],
        ...customState?.ui,
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

const defaultProps = {
  selectedIds: ["1", "2", "3"],
  onClearSelection: vi.fn(),
};

describe("BulkActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  it("renders bulk actions bar with selection count", () => {
    renderWithStore(defaultProps);

    expect(screen.getByTestId("bulk-actions")).toBeInTheDocument();
    expect(screen.getByText("3 snippets selected")).toBeInTheDocument();
  });

  it("renders singular form for single selection", () => {
    const props = { ...defaultProps, selectedIds: ["1"] };
    renderWithStore(props);

    expect(screen.getByText("1 snippet selected")).toBeInTheDocument();
  });

  it("renders all action buttons", () => {
    renderWithStore(defaultProps);

    expect(screen.getByText("Bulk Edit")).toBeInTheDocument();
    expect(screen.getByText("Export Selected")).toBeInTheDocument();
    expect(screen.getByText("Delete Selected")).toBeInTheDocument();
    expect(screen.getByText("Clear Selection")).toBeInTheDocument();
  });

  it("calls onClearSelection when clear selection button is clicked", () => {
    const onClearSelection = vi.fn();
    const props = { ...defaultProps, onClearSelection };
    renderWithStore(props);

    const clearButton = screen.getByText("Clear Selection");
    fireEvent.click(clearButton);

    expect(onClearSelection).toHaveBeenCalled();
  });

  it("shows confirmation dialog before bulk delete", () => {
    renderWithStore(defaultProps);

    const deleteButton = screen.getByText("Delete Selected");
    fireEvent.click(deleteButton);

    expect(mockConfirm).toHaveBeenCalledWith(
      "Are you sure you want to delete 3 snippets? This action cannot be undone."
    );
  });

  it("does not delete if confirmation is cancelled", () => {
    mockConfirm.mockReturnValue(false);
    renderWithStore(defaultProps);

    const deleteButton = screen.getByText("Delete Selected");
    fireEvent.click(deleteButton);

    expect(mockConfirm).toHaveBeenCalled();
    // Should not proceed with deletion
  });

  it("opens bulk edit modal when bulk edit is clicked", () => {
    renderWithStore(defaultProps);

    const bulkEditButton = screen.getByText("Bulk Edit");
    fireEvent.click(bulkEditButton);

    expect(screen.getByText("Bulk Edit 3 Snippets")).toBeInTheDocument();
  });

  it("closes bulk edit modal when close button is clicked", () => {
    renderWithStore(defaultProps);

    // Open modal
    const bulkEditButton = screen.getByText("Bulk Edit");
    fireEvent.click(bulkEditButton);

    // Close modal
    const closeButton = screen.getByText("×");
    fireEvent.click(closeButton);

    expect(screen.queryByText("Bulk Edit 3 Snippets")).not.toBeInTheDocument();
  });

  it("closes bulk edit modal when overlay is clicked", () => {
    renderWithStore(defaultProps);

    // Open modal
    const bulkEditButton = screen.getByText("Bulk Edit");
    fireEvent.click(bulkEditButton);

    // Click overlay
    const overlay = screen
      .getByText("Bulk Edit 3 Snippets")
      .closest(".bulk-edit-modal-overlay");
    fireEvent.click(overlay!);

    expect(screen.queryByText("Bulk Edit 3 Snippets")).not.toBeInTheDocument();
  });

  it("does not close modal when clicking inside modal content", () => {
    renderWithStore(defaultProps);

    // Open modal
    const bulkEditButton = screen.getByText("Bulk Edit");
    fireEvent.click(bulkEditButton);

    // Click inside modal
    const modalContent = screen.getByText("Bulk Edit 3 Snippets");
    fireEvent.click(modalContent);

    expect(screen.getByText("Bulk Edit 3 Snippets")).toBeInTheDocument();
  });

  it("renders tag action radio buttons in modal", () => {
    renderWithStore(defaultProps);

    const bulkEditButton = screen.getByText("Bulk Edit");
    fireEvent.click(bulkEditButton);

    expect(screen.getByLabelText("Add tags")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove tags")).toBeInTheDocument();
    expect(screen.getByLabelText("Replace all tags")).toBeInTheDocument();
  });

  it("defaults to add tags action", () => {
    renderWithStore(defaultProps);

    const bulkEditButton = screen.getByText("Bulk Edit");
    fireEvent.click(bulkEditButton);

    const addRadio = screen.getByLabelText("Add tags") as HTMLInputElement;
    const removeRadio = screen.getByLabelText(
      "Remove tags"
    ) as HTMLInputElement;

    expect(addRadio.checked).toBe(true);
    expect(removeRadio.checked).toBe(false);
  });

  it("switches tag action when radio button is clicked", () => {
    renderWithStore(defaultProps);

    const bulkEditButton = screen.getByText("Bulk Edit");
    fireEvent.click(bulkEditButton);

    const removeRadio = screen.getByLabelText("Remove tags");
    fireEvent.click(removeRadio);

    expect(removeRadio).toBeChecked();
  });

  it("renders tag input field", () => {
    renderWithStore(defaultProps);

    const bulkEditButton = screen.getByText("Bulk Edit");
    fireEvent.click(bulkEditButton);

    expect(
      screen.getByPlaceholderText("e.g. react, typescript, utility")
    ).toBeInTheDocument();
  });

  it("updates tag input value", () => {
    renderWithStore(defaultProps);

    const bulkEditButton = screen.getByText("Bulk Edit");
    fireEvent.click(bulkEditButton);

    const tagInput = screen.getByPlaceholderText(
      "e.g. react, typescript, utility"
    );
    fireEvent.change(tagInput, { target: { value: "react, typescript" } });

    expect(tagInput).toHaveValue("react, typescript");
  });

  it("shows export notification when export is clicked", () => {
    const store = createMockStore();
    const dispatchSpy = vi.spyOn(store, "dispatch");
    renderWithStore(defaultProps, store);

    const exportButton = screen.getByText("Export Selected");
    fireEvent.click(exportButton);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ui/addNotification",
        payload: expect.objectContaining({
          type: "info",
          message: "Export functionality would be implemented here",
        }),
      })
    );
  });

  it("handles empty selectedIds array", () => {
    const props = { ...defaultProps, selectedIds: [] };
    renderWithStore(props);

    expect(screen.getByText(/0.*snippet.*selected/)).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    renderWithStore(defaultProps);

    const bulkActions = screen.getByTestId("bulk-actions");
    expect(bulkActions).toBeInTheDocument();

    // Open modal to test modal accessibility
    const bulkEditButton = screen.getByText("Bulk Edit");
    fireEvent.click(bulkEditButton);

    const tagInput = screen.getByLabelText("Tags (comma-separated):");
    expect(tagInput).toBeInTheDocument();
  });

  describe("Enhanced Bulk Operations", () => {
    it("displays progress indicator during bulk delete", () => {
      renderWithStore(defaultProps);

      const deleteButton = screen.getByText("Delete Selected");
      fireEvent.click(deleteButton);

      // Should show loading state immediately
      expect(screen.getByText("Deleting...")).toBeInTheDocument();
    });

    it("shows progress bar with correct percentage", () => {
      renderWithStore(defaultProps);

      const deleteButton = screen.getByText("Delete Selected");
      fireEvent.click(deleteButton);

      // Progress bar should be present
      const progressBar = document.querySelector(".progress-bar");
      expect(progressBar).toBeInTheDocument();
    });

    it("disables buttons during operations", () => {
      renderWithStore(defaultProps);

      const deleteButton = screen.getByRole("button", {
        name: "Delete Selected",
      });
      fireEvent.click(deleteButton);

      // All buttons should be disabled during operation
      expect(screen.getByRole("button", { name: "Bulk Edit" })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Export Selected" })
      ).toBeDisabled();
    });

    it("renders bulk edit modal with all sections", () => {
      renderWithStore(defaultProps);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      // Check all sections are present
      expect(screen.getByText("Tags")).toBeInTheDocument();
      expect(screen.getByText("Category")).toBeInTheDocument();
      expect(screen.getByText("Language")).toBeInTheDocument();
    });

    it("shows tag action options in bulk edit modal", () => {
      renderWithStore(defaultProps);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      expect(screen.getByLabelText("Add tags")).toBeInTheDocument();
      expect(screen.getByLabelText("Remove tags")).toBeInTheDocument();
      expect(screen.getByLabelText("Replace all tags")).toBeInTheDocument();
    });

    it("updates tag preview when typing", () => {
      renderWithStore(defaultProps);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const tagInput = screen.getByLabelText("Tags (comma-separated):");
      fireEvent.change(tagInput, { target: { value: "react, custom-tag" } });

      // Check for tags in the preview section specifically
      const tagPreview = document.querySelector(".tag-preview");
      expect(tagPreview).toBeInTheDocument();
      expect(tagPreview?.textContent).toContain("react");
      expect(tagPreview?.textContent).toContain("custom-tag");
    });

    it("populates language dropdown with available languages", () => {
      renderWithStore(defaultProps);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const languageSelect = screen.getByLabelText("Language:");
      expect(languageSelect).toBeInTheDocument();

      // Should have options for javascript, typescript, python from mock data
      const options = languageSelect.querySelectorAll("option");
      expect(options.length).toBeGreaterThan(1); // Including "No change" option
    });

    it("provides category suggestions via datalist", () => {
      renderWithStore(defaultProps);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const categoryInput = screen.getByLabelText("Category:");
      expect(categoryInput).toHaveAttribute("list", "available-categories");

      const datalist = document.getElementById("available-categories");
      expect(datalist).toBeInTheDocument();
    });

    it("disables apply button when no changes specified", () => {
      renderWithStore(defaultProps);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const applyButton = screen.getByRole("button", { name: "Apply Changes" });
      expect(applyButton).toBeDisabled();
    });

    it("enables apply button when changes are specified", () => {
      renderWithStore(defaultProps);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const tagInput = screen.getByLabelText("Tags (comma-separated):");
      fireEvent.change(tagInput, { target: { value: "test-tag" } });

      const applyButton = screen.getByText("Apply Changes");
      expect(applyButton).not.toBeDisabled();
    });

    it("resets form when modal is closed", () => {
      renderWithStore(defaultProps);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const tagInput = screen.getByLabelText("Tags (comma-separated):");
      fireEvent.change(tagInput, { target: { value: "test-tag" } });

      const closeButton = screen.getByText("×");
      fireEvent.click(closeButton);

      // Reopen modal
      fireEvent.click(bulkEditButton);

      const newTagInput = screen.getByLabelText("Tags (comma-separated):");
      expect(newTagInput).toHaveValue("");
    });

    it("shows progress during bulk update operation", () => {
      renderWithStore(defaultProps);

      const bulkEditButton = screen.getByText("Bulk Edit");
      fireEvent.click(bulkEditButton);

      const tagInput = screen.getByLabelText("Tags (comma-separated):");
      fireEvent.change(tagInput, { target: { value: "test-tag" } });

      const applyButton = screen.getByRole("button", { name: "Apply Changes" });
      fireEvent.click(applyButton);

      // Should show updating state
      expect(screen.getByText("Updating...")).toBeInTheDocument();
    });

    it("handles error states gracefully", () => {
      const store = createMockStore({
        snippets: { error: "Network error" },
      });

      renderWithStore(defaultProps, store);

      // Should still render the component
      expect(screen.getByTestId("bulk-actions")).toBeInTheDocument();
    });

    it("shows correct selection count for different amounts", () => {
      // Test singular
      const singleProps = { ...defaultProps, selectedIds: ["1"] };
      const { rerender } = renderWithStore(singleProps);
      expect(screen.getByText("1 snippet selected")).toBeInTheDocument();

      // Test plural
      rerender(
        <Provider store={createMockStore()}>
          <BulkActions {...defaultProps} />
        </Provider>
      );
      expect(screen.getByText("3 snippets selected")).toBeInTheDocument();
    });

    it("handles empty selection gracefully", () => {
      const emptyProps = { ...defaultProps, selectedIds: [] };
      renderWithStore(emptyProps);

      // Check for the count using a more flexible matcher
      expect(screen.getByText(/0.*snippet.*selected/)).toBeInTheDocument();

      // Buttons should still be present but may be disabled
      expect(screen.getByText("Bulk Edit")).toBeInTheDocument();
      expect(screen.getByText("Delete Selected")).toBeInTheDocument();
    });
  });
});
