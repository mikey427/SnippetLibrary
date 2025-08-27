import React, { useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { useAppDispatch } from "../../../store/hooks";
import {
  deleteSnippet,
  updateSnippet,
  bulkDeleteSnippets,
  bulkUpdateSnippets,
} from "../../../store/slices/snippetsSlice";
import { addNotification } from "../../../store/slices/uiSlice";
import { RootState } from "../../../store/store";
import { Snippet } from "../../../../../types";
import Button from "../../../components/UI/Button";
import "./BulkActions.css";
import { window } from "vscode";

interface BulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

interface BulkOperationProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
}

interface BulkEditFormData {
  action: "add" | "remove" | "replace";
  tags: string[];
  category?: string;
  language?: string;
}

const BulkActions: React.FC<BulkActionsProps> = ({
  selectedIds,
  onClearSelection,
}) => {
  const dispatch = useAppDispatch();
  const { items: snippets } = useSelector((state: RootState) => state.snippets);

  // Operation states
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [operationProgress, setOperationProgress] =
    useState<BulkOperationProgress | null>(null);

  // Form states
  const [bulkEditForm, setBulkEditForm] = useState<BulkEditFormData>({
    action: "add",
    tags: [],
    category: "",
    language: "",
  });
  const [tagInput, setTagInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");

  const handleBulkDelete = useCallback(async () => {
    if (
      !(window as any).confirm(
        `Are you sure you want to delete ${selectedIds.length} snippets? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setOperationProgress({
      total: selectedIds.length,
      completed: 0,
      failed: 0,
    });

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < selectedIds.length; i++) {
      const id = selectedIds[i];
      const snippet = snippets.find((s) => s.id === id);

      setOperationProgress((prev) =>
        prev
          ? {
              ...prev,
              current: snippet?.title || `Snippet ${i + 1}`,
            }
          : null
      );

      try {
        await dispatch(deleteSnippet(id)).unwrap();
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Failed to delete "${snippet?.title || id}": ${error}`);
      }

      setOperationProgress((prev) =>
        prev
          ? {
              ...prev,
              completed: successCount,
              failed: errorCount,
            }
          : null
      );

      // Small delay to show progress
      if (i < selectedIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    setIsDeleting(false);
    setOperationProgress(null);
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
          }. ${errors.length > 0 ? errors[0] : ""}`,
        })
      );
    }
  }, [selectedIds, snippets, dispatch, onClearSelection]);

  const handleBulkEdit = useCallback(() => {
    setShowBulkEditModal(true);
  }, []);

  const handleBulkEditSubmit = useCallback(async () => {
    const { action, tags, category, language } = bulkEditForm;

    if (tags.length === 0 && !category && !language) {
      dispatch(
        addNotification({
          type: "error",
          message: "Please specify at least one field to update",
        })
      );
      return;
    }

    setIsUpdating(true);
    setOperationProgress({
      total: selectedIds.length,
      completed: 0,
      failed: 0,
    });

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < selectedIds.length; i++) {
      const id = selectedIds[i];
      const snippet = snippets.find((s) => s.id === id);

      if (!snippet) {
        errorCount++;
        continue;
      }

      setOperationProgress((prev) =>
        prev
          ? {
              ...prev,
              current: snippet.title,
            }
          : null
      );

      try {
        const updates: Partial<typeof snippet> = {};

        // Handle tags
        if (tags.length > 0) {
          switch (action) {
            case "add":
              updates.tags = [...new Set([...snippet.tags, ...tags])];
              break;
            case "remove":
              updates.tags = snippet.tags.filter((tag) => !tags.includes(tag));
              break;
            case "replace":
              updates.tags = [...tags];
              break;
          }
        }

        // Handle category
        if (category !== undefined) {
          updates.category = category || undefined;
        }

        // Handle language
        if (language) {
          updates.language = language;
        }

        await dispatch(updateSnippet({ id, updates })).unwrap();
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Failed to update "${snippet.title}": ${error}`);
      }

      setOperationProgress((prev) =>
        prev
          ? {
              ...prev,
              completed: successCount,
              failed: errorCount,
            }
          : null
      );

      // Small delay to show progress
      if (i < selectedIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    setIsUpdating(false);
    setOperationProgress(null);
    setShowBulkEditModal(false);
    setBulkEditForm({ action: "add", tags: [], category: "", language: "" });
    setTagInput("");
    setCategoryInput("");
    onClearSelection();

    if (successCount > 0) {
      dispatch(
        addNotification({
          type: "success",
          message: `Successfully updated ${successCount} snippet${
            successCount > 1 ? "s" : ""
          }`,
        })
      );
    }

    if (errorCount > 0) {
      dispatch(
        addNotification({
          type: "error",
          message: `Failed to update ${errorCount} snippet${
            errorCount > 1 ? "s" : ""
          }. ${errors.length > 0 ? errors[0] : ""}`,
        })
      );
    }
  }, [bulkEditForm, selectedIds, snippets, dispatch, onClearSelection]);

  const handleExportSelected = useCallback(() => {
    // This would trigger an export of only selected snippets
    // Implementation would depend on the export service
    dispatch(
      addNotification({
        type: "info",
        message: "Export functionality would be implemented here",
      })
    );
  }, [dispatch]);

  const handleTagInputChange = useCallback((value: string) => {
    setTagInput(value);
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    setBulkEditForm((prev) => ({ ...prev, tags }));
  }, []);

  const handleCategoryInputChange = useCallback((value: string) => {
    setCategoryInput(value);
    setBulkEditForm((prev) => ({ ...prev, category: value }));
  }, []);

  const handleActionChange = useCallback(
    (action: "add" | "remove" | "replace") => {
      setBulkEditForm((prev) => ({ ...prev, action }));
    },
    []
  );

  const handleLanguageChange = useCallback((language: string) => {
    setBulkEditForm((prev) => ({ ...prev, language }));
  }, []);

  const resetForm = useCallback(() => {
    setBulkEditForm({ action: "add", tags: [], category: "", language: "" });
    setTagInput("");
    setCategoryInput("");
  }, []);

  const getAvailableLanguages = useCallback(() => {
    return [...new Set(snippets.map((s) => s.language))].sort();
  }, [snippets]);

  const getAvailableCategories = useCallback(() => {
    return [...new Set(snippets.map((s) => s.category).filter(Boolean))].sort();
  }, [snippets]);

  return (
    <>
      <div className="bulk-actions" data-testid="bulk-actions">
        <div className="bulk-actions-info">
          <span className="bulk-actions-count">
            {selectedIds.length} snippet{selectedIds.length > 1 ? "s" : ""}{" "}
            selected
          </span>
          {operationProgress && (
            <div className="bulk-actions-progress">
              <div className="progress-text">
                {operationProgress.current && (
                  <span className="progress-current">
                    Processing: {operationProgress.current}
                  </span>
                )}
                <span className="progress-stats">
                  {operationProgress.completed + operationProgress.failed} /{" "}
                  {operationProgress.total}
                  {operationProgress.failed > 0 && (
                    <span className="progress-errors">
                      {" "}
                      ({operationProgress.failed} failed)
                    </span>
                  )}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      ((operationProgress.completed +
                        operationProgress.failed) /
                        operationProgress.total) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bulk-actions-buttons">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleBulkEdit}
            disabled={isDeleting || isUpdating}
          >
            Bulk Edit
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportSelected}
            disabled={isDeleting || isUpdating}
          >
            Export Selected
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={handleBulkDelete}
            disabled={isDeleting || isUpdating}
          >
            {isDeleting ? "Deleting..." : "Delete Selected"}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onClearSelection}
            disabled={isDeleting || isUpdating}
          >
            Clear Selection
          </Button>
        </div>
      </div>

      {showBulkEditModal && (
        <div
          className="bulk-edit-modal-overlay"
          onClick={() => {
            setShowBulkEditModal(false);
            resetForm();
          }}
        >
          <div className="bulk-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bulk-edit-modal-header">
              <h3>Bulk Edit {selectedIds.length} Snippets</h3>
              <button
                className="bulk-edit-modal-close"
                onClick={() => {
                  setShowBulkEditModal(false);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>

            <div className="bulk-edit-modal-content">
              {/* Tags Section */}
              <div className="bulk-edit-section">
                <h4>Tags</h4>
                <div className="tag-action-selector">
                  <label>
                    <input
                      type="radio"
                      name="tagAction"
                      value="add"
                      checked={bulkEditForm.action === "add"}
                      onChange={(e) =>
                        handleActionChange(e.target.value as "add")
                      }
                    />
                    Add tags
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="tagAction"
                      value="remove"
                      checked={bulkEditForm.action === "remove"}
                      onChange={(e) =>
                        handleActionChange(e.target.value as "remove")
                      }
                    />
                    Remove tags
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="tagAction"
                      value="replace"
                      checked={bulkEditForm.action === "replace"}
                      onChange={(e) =>
                        handleActionChange(e.target.value as "replace")
                      }
                    />
                    Replace all tags
                  </label>
                </div>

                <div className="input-group">
                  <label htmlFor="bulk-tag-input">
                    Tags (comma-separated):
                  </label>
                  <input
                    id="bulk-tag-input"
                    type="text"
                    value={tagInput}
                    onChange={(e) => handleTagInputChange(e.target.value)}
                    placeholder="e.g. react, typescript, utility"
                    className="bulk-input"
                  />
                  {bulkEditForm.tags.length > 0 && (
                    <div className="tag-preview">
                      Preview:{" "}
                      {bulkEditForm.tags.map((tag) => (
                        <span key={tag} className="tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Category Section */}
              <div className="bulk-edit-section">
                <h4>Category</h4>
                <div className="input-group">
                  <label htmlFor="bulk-category-input">Category:</label>
                  <input
                    id="bulk-category-input"
                    type="text"
                    value={categoryInput}
                    onChange={(e) => handleCategoryInputChange(e.target.value)}
                    placeholder="Enter category (leave empty to remove)"
                    className="bulk-input"
                    list="available-categories"
                  />
                  <datalist id="available-categories">
                    {getAvailableCategories().map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Language Section */}
              <div className="bulk-edit-section">
                <h4>Language</h4>
                <div className="input-group">
                  <label htmlFor="bulk-language-select">Language:</label>
                  <select
                    id="bulk-language-select"
                    value={bulkEditForm.language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bulk-select"
                  >
                    <option value="">-- No change --</option>
                    {getAvailableLanguages().map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Progress Section */}
              {isUpdating && operationProgress && (
                <div className="bulk-edit-progress">
                  <div className="progress-info">
                    <span>Updating snippets...</span>
                    <span>
                      {operationProgress.completed + operationProgress.failed} /{" "}
                      {operationProgress.total}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${
                          ((operationProgress.completed +
                            operationProgress.failed) /
                            operationProgress.total) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  {operationProgress.current && (
                    <div className="progress-current">
                      Processing: {operationProgress.current}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bulk-edit-modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowBulkEditModal(false);
                  resetForm();
                }}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleBulkEditSubmit}
                disabled={
                  isUpdating ||
                  (bulkEditForm.tags.length === 0 &&
                    !bulkEditForm.category &&
                    !bulkEditForm.language)
                }
              >
                {isUpdating ? "Updating..." : "Apply Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkActions;
