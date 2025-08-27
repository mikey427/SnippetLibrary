import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import { useAppDispatch } from "../../store/hooks";
import { FixedSizeGrid as Grid } from "react-window";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { RootState } from "../../store/store";
import {
  fetchSnippets,
  updateSnippet,
  deleteSnippet,
  toggleSelection,
  clearSelection,
} from "../../store/slices/snippetsSlice";
import { addNotification } from "../../store/slices/uiSlice";
import { Snippet } from "../../../../types";
import Button from "../../components/UI/Button";
import SnippetCard from "./components/SnippetCard";
import FilterControls from "./components/FilterControls";
import ViewModeToggle from "./components/ViewModeToggle";
import BulkActions from "./components/BulkActions";
import "./SnippetGrid.css";

interface FilterState {
  search: string;
  language: string;
  tags: string[];
  category: string;
  sortBy: "title" | "createdAt" | "usageCount";
  sortOrder: "asc" | "desc";
}

const SnippetGrid: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    items: snippets,
    loading,
    error,
    selectedIds,
  } = useSelector((state: RootState) => state.snippets);
  const { viewMode } = useSelector((state: RootState) => state.ui);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    language: "",
    tags: [],
    category: "",
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const [localSnippets, setLocalSnippets] = useState<Snippet[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    dispatch(fetchSnippets());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      dispatch(
        addNotification({
          type: "error",
          message: error,
        })
      );
    }
  }, [error, dispatch]);

  useEffect(() => {
    setLocalSnippets(snippets);
  }, [snippets]);

  // Filter and sort snippets
  const filteredSnippets = useMemo(() => {
    let filtered = [...localSnippets];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (snippet) =>
          snippet.title.toLowerCase().includes(searchLower) ||
          snippet.description.toLowerCase().includes(searchLower) ||
          snippet.code.toLowerCase().includes(searchLower) ||
          snippet.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply language filter
    if (filters.language) {
      filtered = filtered.filter(
        (snippet) => snippet.language === filters.language
      );
    }

    // Apply tags filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter((snippet) =>
        filters.tags.every((tag) => snippet.tags.includes(tag))
      );
    }

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(
        (snippet) => snippet.category === filters.category
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[filters.sortBy];
      let bValue: any = b[filters.sortBy];

      if (filters.sortBy === "createdAt") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (filters.sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [localSnippets, filters]);

  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = localSnippets.findIndex(
          (snippet) => snippet.id === active.id
        );
        const newIndex = localSnippets.findIndex(
          (snippet) => snippet.id === over.id
        );

        if (oldIndex !== -1 && newIndex !== -1) {
          const newSnippets = arrayMove(localSnippets, oldIndex, newIndex);
          setLocalSnippets(newSnippets);
        }
      }
    },
    [localSnippets]
  );

  const handleSnippetEdit = useCallback((snippet: Snippet) => {
    window.location.href = `/snippets/${snippet.id}/edit`;
  }, []);

  const handleSnippetDelete = useCallback(
    async (snippetId: string) => {
      if (window.confirm("Are you sure you want to delete this snippet?")) {
        try {
          await dispatch(deleteSnippet(snippetId)).unwrap();
          dispatch(
            addNotification({
              type: "success",
              message: "Snippet deleted successfully",
            })
          );
        } catch (error) {
          dispatch(
            addNotification({
              type: "error",
              message: "Failed to delete snippet",
            })
          );
        }
      }
    },
    [dispatch]
  );

  const handleSnippetSelect = useCallback(
    (snippetId: string, selected: boolean) => {
      dispatch(toggleSelection(snippetId));
    },
    [dispatch]
  );

  const handleClearSelection = useCallback(() => {
    dispatch(clearSelection());
  }, [dispatch]);

  // Grid item renderer for virtual scrolling
  const GridItem = useCallback(
    ({ columnIndex, rowIndex, style }: any) => {
      const itemsPerRow = viewMode === "grid" ? 3 : 1;
      const index = rowIndex * itemsPerRow + columnIndex;
      const snippet = filteredSnippets[index];

      if (!snippet) {
        return <div style={style} />;
      }

      return (
        <div style={style}>
          <SnippetCard
            snippet={snippet}
            selected={selectedIds.includes(snippet.id)}
            onEdit={handleSnippetEdit}
            onDelete={handleSnippetDelete}
            onSelect={handleSnippetSelect}
            viewMode={viewMode}
          />
        </div>
      );
    },
    [
      filteredSnippets,
      selectedIds,
      viewMode,
      handleSnippetEdit,
      handleSnippetDelete,
      handleSnippetSelect,
    ]
  );

  if (loading) {
    return (
      <div className="snippet-grid-loading" data-testid="loading">
        <div className="loading-spinner">Loading snippets...</div>
      </div>
    );
  }

  const itemsPerRow = viewMode === "grid" ? 3 : 1;
  const rowCount = Math.ceil(filteredSnippets.length / itemsPerRow);
  const columnCount = Math.min(filteredSnippets.length, itemsPerRow);

  return (
    <div className="snippet-grid-container" data-testid="snippet-grid">
      <div className="snippet-grid-header">
        <div className="snippet-grid-title">
          <h2>Snippets ({filteredSnippets.length})</h2>
          {selectedIds.length > 0 && (
            <span className="selection-count">
              {selectedIds.length} selected
            </span>
          )}
        </div>
        <div className="snippet-grid-controls">
          <ViewModeToggle />
          <Button onClick={() => (window.location.href = "/snippets/new")}>
            New Snippet
          </Button>
        </div>
      </div>

      <FilterControls
        filters={filters}
        onFilterChange={handleFilterChange}
        availableLanguages={[...new Set(snippets.map((s) => s.language))]}
        availableTags={[...new Set(snippets.flatMap((s) => s.tags))]}
        availableCategories={[
          ...new Set(
            snippets
              .map((s) => s.category)
              .filter((cat): cat is string => Boolean(cat))
          ),
        ]}
      />

      {selectedIds.length > 0 && (
        <BulkActions
          selectedIds={selectedIds}
          onClearSelection={handleClearSelection}
        />
      )}

      {filteredSnippets.length === 0 ? (
        <div className="snippet-grid-empty">
          {filters.search ||
          filters.language ||
          filters.tags.length > 0 ||
          filters.category ? (
            <>
              <p>No snippets match your current filters.</p>
              <Button
                onClick={() =>
                  setFilters({
                    search: "",
                    language: "",
                    tags: [],
                    category: "",
                    sortBy: "createdAt",
                    sortOrder: "desc",
                  })
                }
              >
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <p>
                No snippets found. Create your first snippet to get started!
              </p>
              <Button onClick={() => (window.location.href = "/snippets/new")}>
                Create Snippet
              </Button>
            </>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredSnippets.map((s) => s.id)}
            strategy={rectSortingStrategy}
          >
            <div className="snippet-grid-virtualized">
              <Grid
                className={`snippet-grid-virtual ${viewMode}`}
                columnCount={columnCount}
                columnWidth={viewMode === "grid" ? 350 : 1050}
                height={600}
                rowCount={rowCount}
                rowHeight={viewMode === "grid" ? 280 : 200}
                width={viewMode === "grid" ? 1050 : 1050}
              >
                {GridItem}
              </Grid>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default SnippetGrid;
