import React, { useState } from "react";
import Button from "../../../components/UI/Button";
import "./FilterControls.css";

interface FilterState {
  search: string;
  language: string;
  tags: string[];
  category: string;
  sortBy: "title" | "createdAt" | "usageCount";
  sortOrder: "asc" | "desc";
}

interface FilterControlsProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  availableLanguages: string[];
  availableTags: string[];
  availableCategories: string[];
}

const FilterControls: React.FC<FilterControlsProps> = ({
  filters,
  onFilterChange,
  availableLanguages,
  availableTags,
  availableCategories,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ search: e.target.value });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ language: e.target.value });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ category: e.target.value });
  };

  const handleSortByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ sortBy: e.target.value as FilterState["sortBy"] });
  };

  const handleSortOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ sortOrder: e.target.value as FilterState["sortOrder"] });
  };

  const handleTagAdd = (tag: string) => {
    if (tag && !filters.tags.includes(tag)) {
      onFilterChange({ tags: [...filters.tags, tag] });
    }
    setTagInput("");
  };

  const handleTagRemove = (tagToRemove: string) => {
    onFilterChange({
      tags: filters.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleTagInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTagAdd(tagInput);
    }
  };

  const clearAllFilters = () => {
    onFilterChange({
      search: "",
      language: "",
      tags: [],
      category: "",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    setTagInput("");
  };

  const hasActiveFilters =
    filters.search ||
    filters.language ||
    filters.tags.length > 0 ||
    filters.category ||
    filters.sortBy !== "createdAt" ||
    filters.sortOrder !== "desc";

  return (
    <div className="filter-controls">
      <div className="filter-controls-main">
        <div className="search-input-container">
          <input
            type="text"
            placeholder="Search snippets..."
            value={filters.search}
            onChange={handleSearchChange}
            className="search-input"
          />
          <svg
            className="search-icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
          </svg>
        </div>

        <div className="filter-controls-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Hide Filters" : "Show Filters"}
          </Button>
          {hasActiveFilters && (
            <Button variant="secondary" size="sm" onClick={clearAllFilters}>
              Clear All
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="filter-controls-expanded">
          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="language-filter">Language</label>
              <select
                id="language-filter"
                value={filters.language}
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
                value={filters.category}
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
                value={filters.sortBy}
                onChange={handleSortByChange}
                className="filter-select"
              >
                <option value="createdAt">Created Date</option>
                <option value="title">Title</option>
                <option value="usageCount">Usage Count</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="sort-order-filter">Order</label>
              <select
                id="sort-order-filter"
                value={filters.sortOrder}
                onChange={handleSortOrderChange}
                className="filter-select"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group tags-filter">
              <label htmlFor="tags-filter">Tags</label>
              <div className="tags-input-container">
                <input
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
                    .filter((tag) => !filters.tags.includes(tag))
                    .slice(0, 10)
                    .map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagAdd(tag)}
                        className="available-tag"
                        type="button"
                      >
                        {tag}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {filters.tags.length > 0 && (
            <div className="selected-tags">
              <span className="selected-tags-label">Selected Tags:</span>
              <div className="selected-tags-list">
                {filters.tags.map((tag) => (
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
    </div>
  );
};

export default FilterControls;
