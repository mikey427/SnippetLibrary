import React, { useState } from "react";
import { useAppSelector } from "../../store/hooks";
import { SearchInterface } from "../../components/Search";
import SnippetCard from "../SnippetGrid/components/SnippetCard";
import { Snippet } from "../../../types";
import "./SearchPage.css";

const SearchPage: React.FC = () => {
  const [searchResults, setSearchResults] = useState<Snippet[]>([]);
  const { loading } = useAppSelector((state) => state.search);

  const handleResultsChange = (results: Snippet[]) => {
    setSearchResults(results);
  };

  return (
    <div className="search-page" data-testid="search-page">
      <div className="search-page-header">
        <h2>Advanced Search</h2>
        <p>Search and filter your snippet library with advanced criteria</p>
      </div>

      <SearchInterface
        onResultsChange={handleResultsChange}
        showResults={false}
      />

      <div className="search-results-section">
        {loading ? (
          <div className="search-loading">
            <div className="loading-spinner"></div>
            <span>Searching snippets...</span>
          </div>
        ) : (
          <>
            <div className="search-results-header">
              <h3>
                {searchResults.length} Result
                {searchResults.length !== 1 ? "s" : ""}
              </h3>
            </div>
            <div className="search-results-grid">
              {searchResults.length > 0 ? (
                searchResults.map((snippet) => (
                  <SnippetCard
                    key={snippet.id}
                    snippet={snippet}
                    isSelected={false}
                    onSelect={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    searchTerm=""
                  />
                ))
              ) : (
                <div className="no-results">
                  <div className="no-results-icon">🔍</div>
                  <h4>No snippets found</h4>
                  <p>Try adjusting your search criteria or filters</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
