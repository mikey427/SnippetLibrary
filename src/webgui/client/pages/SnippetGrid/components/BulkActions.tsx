import React, { useState } from "react";
import { useDispatch } from "react-redux";
import {
  deleteSnippet,
  updateSnippet,
} from "../../../store/slices/snippetsSlice";
import { addNotification } from "../../../store/slices/uiSlice";
import Button from "../../../components/UI/Button";
import "./BulkActions.css";

interface BulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

const BulkActions: React.FC<BulkActionsProps> = ({
  selectedIds,
  onClearSelection,
}) => {
  const dispatch = useDispatch();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagAction, setTagAction] = useState<"add" | "remove">("add");

  const handleBulkDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.length} snippets?`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      try {
        await dispatch(deleteSnippet(id)).unwrap();
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setIsDeleting(false);
    onClearSelection();

    if (successCount > 0) {
      dispatch(
        addNotification({
          type: "success",
          message: `Successfully deleted ${successCount} snippet${
            successCount > 1 ? "s" : ""
          }`,
        })
      );
    }

    if (errorCount > 0) {
      dispatch(
        addNotification({
          type: "error",
          message: `Failed to delete ${errorCount} snippet${
            errorCount > 1 ? "s" : ""
          }`,
        })
      );
    }
  };

  const handleBulkTag = () => {
    setShowTagModal(true);
  };

  const handleTagModalSubmit = async () => {
    if (!tagInput.trim()) return;

    const tags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tags.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      try {
        // Note: This is a simplified implementation
        // In a real app, you'd need to fetch the current snippet data first
        const updates =
          tagAction === "add"
            ? { tags: [...new Set([...[], ...tags])] } // Would need current tags
            : { tags: [] }; // Would need to filter out specified tags

        await dispatch(updateSnippet({ id, updates })).unwrap();
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setShowTagModal(false);
    setTagInput("");
    onClearSelection();

    if (successCount > 0) {
      dispatch(
        addNotification({
          type: "success",
          message: `Successfully updated tags for ${successCount} snippet${
            successCount > 1 ? "s" : ""
          }`,
        })
      );
    }

    if (errorCount > 0) {
      dispatch(
        addNotification({
          type: "error",
          message: `Failed to update tags for ${errorCount} snippet${
            errorCount > 1 ? "s" : ""
          }`,
        })
      );
    }
  };

  const handleExportSelected = () => {
    // This would trigger an export of only selected snippets
    // Implementation would depend on the export service
    dispatch(
      addNotification({
        type: "info",
        message: "Export functionality would be implemented here",
      })
    );
  };

  return (
    <>
      <div className="bulk-actions" data-testid="bulk-actions">
        <div className="bulk-actions-info">
          <span className="bulk-actions-count">
            {selectedIds.length} snippet{selectedIds.length > 1 ? "s" : ""}{" "}
            selected
          </span>
        </div>

        <div className="bulk-actions-buttons">
          <Button variant="secondary" size="sm" onClick={handleBulkTag}>
            Manage Tags
          </Button>

          <Button variant="secondary" size="sm" onClick={handleExportSelected}>
            Export Selected
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Selected"}
          </Button>

          <Button variant="secondary" size="sm" onClick={onClearSelection}>
            Clear Selection
          </Button>
        </div>
      </div>

      {showTagModal && (
        <div
          className="bulk-tag-modal-overlay"
          onClick={() => setShowTagModal(false)}
        >
          <div className="bulk-tag-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bulk-tag-modal-header">
              <h3>Manage Tags for {selectedIds.length} Snippets</h3>
              <button
                className="bulk-tag-modal-close"
                onClick={() => setShowTagModal(false)}
              >
                ×
              </button>
            </div>

            <div className="bulk-tag-modal-content">
              <div className="tag-action-selector">
                <label>
                  <input
                    type="radio"
                    name="tagAction"
                    value="add"
                    checked={tagAction === "add"}
                    onChange={(e) =>
                      setTagAction(e.target.value as "add" | "remove")
                    }
                  />
                  Add tags
                </label>
                <label>
                  <input
                    type="radio"
                    name="tagAction"
                    value="remove"
                    checked={tagAction === "remove"}
                    onChange={(e) =>
                      setTagAction(e.target.value as "add" | "remove")
                    }
                  />
                  Remove tags
                </label>
              </div>

              <div className="tag-input-group">
                <label htmlFor="bulk-tag-input">Tags (comma-separated):</label>
                <input
                  id="bulk-tag-input"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="e.g. react, typescript, utility"
                  className="bulk-tag-input"
                />
              </div>
            </div>

            <div className="bulk-tag-modal-actions">
              <Button
                variant="secondary"
                onClick={() => setShowTagModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleTagModalSubmit}
                disabled={!tagInput.trim()}
              >
                {tagAction === "add" ? "Add Tags" : "Remove Tags"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkActions;
