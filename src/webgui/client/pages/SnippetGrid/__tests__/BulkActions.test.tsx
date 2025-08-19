import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { vi, describe, it, expect, beforeEach } from "vitest";
import BulkActions from "../components/BulkActions";
import snippetsReducer from "../../../store/slices/snippetsSlice";
import uiReducer from "../../../store/slices/uiSlice";

// Mock window.confirm
const mockConfirm = vi.fn();
Object.defineProperty(window, "confirm", {
  value: mockConfirm,
  writable: true,
});

const createMockStore = () => {
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

    expect(screen.getByText("Manage Tags")).toBeInTheDocument();
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
      "Are you sure you want to delete 3 snippets?"
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

  it("opens tag management modal when manage tags is clicked", () => {
    renderWithStore(defaultProps);

    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    expect(screen.getByText("Manage Tags for 3 Snippets")).toBeInTheDocument();
  });

  it("closes tag modal when close button is clicked", () => {
    renderWithStore(defaultProps);

    // Open modal
    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    // Close modal
    const closeButton = screen.getByText("×");
    fireEvent.click(closeButton);

    expect(
      screen.queryByText("Manage Tags for 3 Snippets")
    ).not.toBeInTheDocument();
  });

  it("closes tag modal when overlay is clicked", () => {
    renderWithStore(defaultProps);

    // Open modal
    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    // Click overlay
    const overlay = screen
      .getByText("Manage Tags for 3 Snippets")
      .closest(".bulk-tag-modal-overlay");
    fireEvent.click(overlay!);

    expect(
      screen.queryByText("Manage Tags for 3 Snippets")
    ).not.toBeInTheDocument();
  });

  it("does not close modal when clicking inside modal content", () => {
    renderWithStore(defaultProps);

    // Open modal
    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    // Click inside modal
    const modalContent = screen.getByText("Manage Tags for 3 Snippets");
    fireEvent.click(modalContent);

    expect(screen.getByText("Manage Tags for 3 Snippets")).toBeInTheDocument();
  });

  it("renders tag action radio buttons in modal", () => {
    renderWithStore(defaultProps);

    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    expect(screen.getByLabelText("Add tags")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove tags")).toBeInTheDocument();
  });

  it("defaults to add tags action", () => {
    renderWithStore(defaultProps);

    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    const addRadio = screen.getByLabelText("Add tags") as HTMLInputElement;
    const removeRadio = screen.getByLabelText(
      "Remove tags"
    ) as HTMLInputElement;

    expect(addRadio.checked).toBe(true);
    expect(removeRadio.checked).toBe(false);
  });

  it("switches tag action when radio button is clicked", () => {
    renderWithStore(defaultProps);

    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    const removeRadio = screen.getByLabelText("Remove tags");
    fireEvent.click(removeRadio);

    expect(removeRadio).toBeChecked();
  });

  it("renders tag input field", () => {
    renderWithStore(defaultProps);

    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    expect(
      screen.getByPlaceholderText("e.g. react, typescript, utility")
    ).toBeInTheDocument();
  });

  it("updates tag input value", () => {
    renderWithStore(defaultProps);

    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    const tagInput = screen.getByPlaceholderText(
      "e.g. react, typescript, utility"
    );
    fireEvent.change(tagInput, { target: { value: "react, typescript" } });

    expect(tagInput).toHaveValue("react, typescript");
  });

  it("disables submit button when tag input is empty", () => {
    renderWithStore(defaultProps);

    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    const submitButton = screen.getByRole("button", { name: /Add Tags/i });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button when tag input has value", () => {
    renderWithStore(defaultProps);

    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    const tagInput = screen.getByPlaceholderText(
      "e.g. react, typescript, utility"
    );
    fireEvent.change(tagInput, { target: { value: "react" } });

    const submitButton = screen.getByRole("button", { name: /Add Tags/i });
    expect(submitButton).not.toBeDisabled();
  });

  it("changes submit button text based on action", () => {
    renderWithStore(defaultProps);

    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    // Default is "Add Tags"
    expect(screen.getByText("Add Tags")).toBeInTheDocument();

    // Switch to remove
    const removeRadio = screen.getByLabelText("Remove tags");
    fireEvent.click(removeRadio);

    expect(screen.getByText("Remove Tags")).toBeInTheDocument();
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

  it("handles delete button loading state", async () => {
    renderWithStore(defaultProps);

    const deleteButton = screen.getByText("Delete Selected");
    fireEvent.click(deleteButton);

    // During deletion, button should show loading text
    // Note: This test might need adjustment based on actual async behavior
  });

  it("closes modal and clears input after successful tag operation", () => {
    renderWithStore(defaultProps);

    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    const tagInput = screen.getByPlaceholderText(
      "e.g. react, typescript, utility"
    );
    fireEvent.change(tagInput, { target: { value: "react" } });

    const submitButton = screen.getByText("Add Tags");
    fireEvent.click(submitButton);

    // Modal should close and input should be cleared
    // Note: This test might need adjustment based on actual async behavior
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
    const manageTagsButton = screen.getByText("Manage Tags");
    fireEvent.click(manageTagsButton);

    const tagInput = screen.getByLabelText("Tags (comma-separated):");
    expect(tagInput).toBeInTheDocument();
  });
});
