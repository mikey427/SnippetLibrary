import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  searchSnippets,
  updateQuery,
  addToHistory,
  clearQuery,
} from "../../store/slices/searchSlice";
import { SearchQueryInterface } from "../../../../types";
import Button from "../UI/Button";
import Input from "../UI/Input";
import "./SearchInterface.css";

interface SavedSearch {
  id: string;
  name: string;
  query: SearchQueryInterface;
  createdAt: Date;
}

interface SearchInterfaceProps {
  onResultsChange?: (results: any[]) => void;
  showResults?: boolean;
  compact?: boolean;
}

const SearchInterface: React.FC<SearchInterfaceProps> = ({
  onResultsChange,
  showResults = true,
  compact = false,
}) => {
  const dispatch = useAppDispatch();
  const { query, results, loading, error, history } = useAppSelector(
    (state) => state.search
  );
  const { items: snippets } = useAppSelector((state) => state.snippets);

  // Local state
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  // Available options for filters
  const availableLanguages = useMemo(() => {
    const languages = new Set(snippets.map((s) => s.language));
    return Array.from(languages).sort();
  }, [snippets]);

  const availableTags = useMemo(() => {
    const tags = new Set(snippets.flatMap((s) => s.tags));
    return Array.from(tags).sort();
  }, [snippets]);

  const availableCategories = useMemo(() => {
    const categories = new Set(
      snippets.map((s) => s.category).filter(Boolean) as string[]
    );
    return Array.from(categories).sort();
  }, [snippets]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      if (query.text || hasActiveFilters()) {
        dispatch(searchSnippets(query));
        if (query.text) {
          dispatch(addToHistory(query.text));
        }
      }
    }, 300);

    setSearchTimeout(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [query, dispatch]);

  // Notify parent of results changes
  useEffect(() => {
    if (onResultsChange) {
      onResultsChange(results);
    }
  }, [results, onResultsChange]);

  // Load saved searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("snippet-saved-searches");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedSearches(
          parsed.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt),
          }))
        );
      } catch (error) {
        console.error("Failed to load saved searches:", error);
      }
    }
  }, []);

  const hasActiveFilters = useCallback(() => {
    return (
      query.language ||
      (query.tags && query.tags.length > 0) ||
      query.category ||
      query.dateRange ||
      (query.sortBy && query.sortBy !== "title") ||
      (query.sortOrder && query.sortOrder !== "asc")
    );
  }, [query]);

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateQuery({ text: event.target.value }));
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(updateQuery({ language: e.target.value || undefined }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(updateQuery({ category: e.target.value || undefined }));
  };

  const handleSortByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(
      updateQuery({
        sortBy: e.target.value as SearchQueryInterface["sortBy"],
      })
    );
  };

  const handleSortOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(
      updateQuery({
        sortOrder: e.target.value as SearchQueryInterface["sortOrder"],
      })
    );
  };

  const handleTagAdd = (tag: string) => {
    if (tag && (!query.tags || !query.tags.includes(tag))) {
      const newTags = query.tags ? [...query.tags, tag] : [tag];
      dispatch(updateQuery({ tags: newTags }));
    }
    setTagInput("");
  };

  const handleTagRemove = (tagToRemove: string) => {
    if (query.tags) {
      const newTags = query.tags.filter((tag) => tag !== tagToRemove);
      dispatch(updateQuery({ tags: newTags.length > 0 ? newTags : undefined }));
    }
  };

  const handleTagInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTagAdd(tagInput);
    }
  };

  const handleDateRangeChange = (field: "start" | "end", value: string) => {
    const date = value ? new Date(value) : undefined;
    const currentRange = query.dateRange;

    if (field === "start") {
      const newRange = date
        ? { start: date, end: currentRange?.end || new Date() }
        : undefined;
      dispatch(updateQuery({ dateRange: newRange }));
    } else {
      const newRange =
        date && currentRange?.start
          ? { start: currentRange.start, end: date }
          : undefined;
      dispatch(updateQuery({ dateRange: newRange }));
    }
  };

  const clearAllFilters = () => {
    dispatch(clearQuery());
    setTagInput("");
  };

  const saveCurrentSearch = () => {
    if (!saveSearchName.trim()) return;

    const newSavedSearch: SavedSearch = {
      id: Date.now().toString(),
      name: saveSearchName.trim(),
      query: { ...query },
      createdAt: new Date(),
    };

    const updatedSavedSearches = [...savedSearches, newSavedSearch];
    setSavedSearches(updatedSavedSearches);
    localStorage.setItem(
      "snippet-saved-searches",
      JSON.stringify(updatedSavedSearches)
    );

    setSaveSearchName("");
    setShowSaveDialog(false);
  };

  const loadSavedSearch = (savedSearch: SavedSearch) => {
    dispatch(updateQuery(savedSearch.query));
    setShowSavedSearches(false);
  };

  const deleteSavedSearch = (id: string) => {
    const updatedSavedSearches = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(updatedSavedSearches);
    localStorage.setItem(
      "snippet-saved-searches",
      JSON.stringify(updatedSavedSearches)
    );
  };

  const loadFromHistory = (text: string) => {
    dispatch(updateQuery({ text }));
    setShowHistory(false);
  };

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;

    const regex = new RegExp(`(${searchTerm})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className={`search-interface ${compact ? "compact" : ""}`}>
      <div className="search-main">
        <div className="search-input-container">
          <Input
            type="text"
            placeholder="Search snippets..."
            value={query.text || ""}
            onChange={handleTextChange}
            className="search-input"
          />
          <div className="search-input-actions">
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                title="Search History"
              >
                📋
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Hide Filters" : "Show Filters"}
            >
              🔍
            </Button>
          </div>
        </div>

        {showHistory && (
          <div className="search-history">
            <div className="search-history-header">
              <span>Recent Searches</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(false)}
              >
                ×
              </Button>
            </div>
            <div className="search-history-list">
              {history.map((item, index) => (
                <button
                  key={index}
                  className="search-history-item"
                  onClick={() => loadFromHistory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="search-actions">
          {(query.text || hasActiveFilters()) && (
            <Button variant="secondary" size="sm" onClick={clearAllFilters}>
              Clear All
            </Button>
          )}
          {(query.text || hasActiveFilters()) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSaveDialog(true)}
            >
              Save Search
            </Button>
          )}
          {savedSearches.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSavedSearches(!showSavedSearches)}
            >
              Saved Searches ({savedSearches.length})
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="search-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="language-filter">Language</label>
              <select
                id="language-filter"
                value={query.language || ""}
                onChange={handleLanguageChange}
                className="filter-select"
              >
                <option value="">All Languages</option>
                {availableLanguages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="category-filter">Category</label>
              <select
                id="category-filter"
                value={query.category || ""}
                onChange={handleCategoryChange}
                className="filter-select"
              >
                <option value="">All Categories</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="sort-by-filter">Sort By</label>
              <select
                id="sort-by-filter"
                value={query.sortBy || "title"}
                onChange={handleSortByChange}
                className="filter-select"
              >
                <option value="title">Title</option>
                <option value="createdAt">Created Date</option>
                <option value="usageCount">Usage Count</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="sort-order-filter">Order</label>
              <select
                id="sort-order-filter"
                value={query.sortOrder || "asc"}
                onChange={handleSortOrderChange}
                className="filter-select"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group tags-filter">
              <label htmlFor="tags-filter">Tags</label>
              <div className="tags-input-container">
                <Input
                  id="tags-filter"
                  type="text"
                  placeholder="Add tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleTagInputKeyPress}
                  className="tags-input"
                />
                <div className="available-tags">
                  {availableTags
                    .filter((tag) => !query.tags?.includes(tag))
                    .filter((tag) =>
                      tagInput
                        ? tag.toLowerCase().includes(tagInput.toLowerCase())
                        : true
                    )
                    .slice(0, 8)
                    .map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagAdd(tag)}
                        className="available-tag"
                        type="button"
                      >
                        {tagInput ? highlightText(tag, tagInput) : tag}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="date-start">Date Range</label>
              <div className="date-range-inputs">
                <input
                  id="date-start"
                  type="date"
                  value={
                    query.dateRange?.start
                      ? query.dateRange.start.toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    handleDateRangeChange("start", e.target.value)
                  }
                  className="date-input"
                />
                <span>to</span>
                <input
                  type="date"
                  value={
                    query.dateRange?.end
                      ? query.dateRange.end.toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => handleDateRangeChange("end", e.target.value)}
                  className="date-input"
                />
              </div>
            </div>
          </div>

          {query.tags && query.tags.length > 0 && (
            <div className="selected-tags">
              <span className="selected-tags-label">Selected Tags:</span>
              <div className="selected-tags-list">
                {query.tags.map((tag) => (
                  <span key={tag} className="selected-tag">
                    {tag}
                    <button
                      onClick={() => handleTagRemove(tag)}
                      className="remove-tag"
                      type="button"
                      aria-label={`Remove ${tag} tag`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showSavedSearches && (
        <div className="saved-searches">
          <div className="saved-searches-header">
            <span>Saved Searches</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSavedSearches(false)}
            >
              ×
            </Button>
          </div>
          <div className="saved-searches-list">
            {savedSearches.map((savedSearch) => (
              <div key={savedSearch.id} className="saved-search-item">
                <button
                  className="saved-search-button"
                  onClick={() => loadSavedSearch(savedSearch)}
                >
                  <div className="saved-search-name">{savedSearch.name}</div>
                  <div className="saved-search-details">
                    {savedSearch.query.text && (
                      <span>"{savedSearch.query.text}"</span>
                    )}
                    {savedSearch.query.language && (
                      <span>Lang: {savedSearch.query.language}</span>
                    )}
                    {savedSearch.query.tags &&
                      savedSearch.query.tags.length > 0 && (
                        <span>Tags: {savedSearch.query.tags.join(", ")}</span>
                      )}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteSavedSearch(savedSearch.id)}
                  className="delete-saved-search"
                >
                  🗑️
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSaveDialog && (
        <div className="save-search-dialog">
          <div className="save-search-content">
            <h3>Save Search</h3>
            <Input
              type="text"
              placeholder="Enter search name..."
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  saveCurrentSearch();
                }
              }}
            />
            <div className="save-search-actions">
              <Button variant="primary" onClick={saveCurrentSearch}>
                Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showResults && (
        <div className="search-results">
          {loading && <div className="search-loading">Searching...</div>}
          {error && <div className="search-error">Error: {error}</div>}
          {!loading && !error && (
            <div className="search-results-info">
              {results.length} result{results.length !== 1 ? "s" : ""} found
              {query.text && <span> for "{query.text}"</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchInterface;
