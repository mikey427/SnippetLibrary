import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Snippet } from "../../../types/Snippet";
import { snippetAPI } from "../../services/api";

interface SnippetsState {
  items: Snippet[];
  loading: boolean;
  error: string | null;
  selectedIds: string[];
}

const initialState: SnippetsState = {
  items: [],
  loading: false,
  error: null,
  selectedIds: [],
};

// Async thunks
export const fetchSnippets = createAsyncThunk(
  "snippets/fetchSnippets",
  async () => {
    const response = await snippetAPI.getAll();
    return response;
  }
);

export const createSnippet = createAsyncThunk(
  "snippets/createSnippet",
  async (
    snippetData: Omit<Snippet, "id" | "createdAt" | "updatedAt" | "usageCount">
  ) => {
    const response = await snippetAPI.create(snippetData);
    return response;
  }
);

export const updateSnippet = createAsyncThunk(
  "snippets/updateSnippet",
  async ({ id, updates }: { id: string; updates: Partial<Snippet> }) => {
    const response = await snippetAPI.update(id, updates);
    return response;
  }
);

export const deleteSnippet = createAsyncThunk(
  "snippets/deleteSnippet",
  async (id: string) => {
    await snippetAPI.delete(id);
    return id;
  }
);

export const bulkDeleteSnippets = createAsyncThunk(
  "snippets/bulkDeleteSnippets",
  async (ids: string[]) => {
    const results = await Promise.allSettled(
      ids.map((id) => snippetAPI.delete(id))
    );

    const successful: string[] = [];
    const failed: { id: string; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successful.push(ids[index]);
      } else {
        failed.push({
          id: ids[index],
          error: result.reason?.message || "Unknown error",
        });
      }
    });

    return { successful, failed };
  }
);

export const bulkUpdateSnippets = createAsyncThunk(
  "snippets/bulkUpdateSnippets",
  async (updates: { id: string; updates: Partial<Snippet> }[]) => {
    const results = await Promise.allSettled(
      updates.map(({ id, updates }) => snippetAPI.update(id, updates))
    );

    const successful: Snippet[] = [];
    const failed: { id: string; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successful.push(result.value);
      } else {
        failed.push({
          id: updates[index].id,
          error: result.reason?.message || "Unknown error",
        });
      }
    });

    return { successful, failed };
  }
);

const snippetsSlice = createSlice({
  name: "snippets",
  initialState,
  reducers: {
    setSelectedIds: (state, action: PayloadAction<string[]>) => {
      state.selectedIds = action.payload;
    },
    toggleSelection: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const index = state.selectedIds.indexOf(id);
      if (index >= 0) {
        state.selectedIds.splice(index, 1);
      } else {
        state.selectedIds.push(id);
      }
    },
    clearSelection: (state) => {
      state.selectedIds = [];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch snippets
      .addCase(fetchSnippets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSnippets.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchSnippets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch snippets";
      })
      // Create snippet
      .addCase(createSnippet.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(createSnippet.rejected, (state, action) => {
        state.error = action.error.message || "Failed to create snippet";
      })
      // Update snippet
      .addCase(updateSnippet.fulfilled, (state, action) => {
        const index = state.items.findIndex(
          (item) => item.id === action.payload.id
        );
        if (index >= 0) {
          state.items[index] = action.payload;
        }
      })
      .addCase(updateSnippet.rejected, (state, action) => {
        state.error = action.error.message || "Failed to update snippet";
      })
      // Delete snippet
      .addCase(deleteSnippet.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.selectedIds = state.selectedIds.filter(
          (id) => id !== action.payload
        );
      })
      .addCase(deleteSnippet.rejected, (state, action) => {
        state.error = action.error.message || "Failed to delete snippet";
      })
      // Bulk delete snippets
      .addCase(bulkDeleteSnippets.fulfilled, (state, action) => {
        const { successful } = action.payload;
        state.items = state.items.filter(
          (item) => !successful.includes(item.id)
        );
        state.selectedIds = state.selectedIds.filter(
          (id) => !successful.includes(id)
        );
      })
      .addCase(bulkDeleteSnippets.rejected, (state, action) => {
        state.error = action.error.message || "Failed to delete snippets";
      })
      // Bulk update snippets
      .addCase(bulkUpdateSnippets.fulfilled, (state, action) => {
        const { successful } = action.payload;
        successful.forEach((updatedSnippet) => {
          const index = state.items.findIndex(
            (item) => item.id === updatedSnippet.id
          );
          if (index >= 0) {
            state.items[index] = updatedSnippet;
          }
        });
      })
      .addCase(bulkUpdateSnippets.rejected, (state, action) => {
        state.error = action.error.message || "Failed to update snippets";
      });
  },
});

export const { setSelectedIds, toggleSelection, clearSelection, clearError } =
  snippetsSlice.actions;
export default snippetsSlice.reducer;
