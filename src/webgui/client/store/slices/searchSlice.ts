import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Snippet } from "../../../types/Snippet";
import { SearchQuery } from "../../../types/SearchQuery";
import { snippetAPI } from "../../services/api";

interface SearchState {
  query: SearchQuery;
  results: Snippet[];
  loading: boolean;
  error: string | null;
  history: string[];
}

const initialState: SearchState = {
  query: {
    text: "",
    language: "",
    tags: [],
    category: "",
    sortBy: "title",
    sortOrder: "asc",
  },
  results: [],
  loading: false,
  error: null,
  history: [],
};

// Async thunks
export const searchSnippets = createAsyncThunk(
  "search/searchSnippets",
  async (query: SearchQuery) => {
    const response = await snippetAPI.search(query);
    return response;
  }
);

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<SearchQuery>) => {
      state.query = action.payload;
    },
    updateQuery: (state, action: PayloadAction<Partial<SearchQuery>>) => {
      state.query = { ...state.query, ...action.payload };
    },
    clearQuery: (state) => {
      state.query = initialState.query;
    },
    addToHistory: (state, action: PayloadAction<string>) => {
      const text = action.payload.trim();
      if (text && !state.history.includes(text)) {
        state.history.unshift(text);
        // Keep only last 10 searches
        if (state.history.length > 10) {
          state.history = state.history.slice(0, 10);
        }
      }
    },
    clearHistory: (state) => {
      state.history = [];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchSnippets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchSnippets.fulfilled, (state, action) => {
        state.loading = false;
        state.results = action.payload;
      })
      .addCase(searchSnippets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Search failed";
      });
  },
});

export const {
  setQuery,
  updateQuery,
  clearQuery,
  addToHistory,
  clearHistory,
  clearError,
} = searchSlice.actions;

export default searchSlice.reducer;
