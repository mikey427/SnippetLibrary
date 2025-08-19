import { configureStore } from "@reduxjs/toolkit";
import snippetsReducer, {
  setSelectedIds,
  toggleSelection,
  clearSelection,
  clearError,
  fetchSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
} from "../slices/snippetsSlice";
import { it } from "node:test";
import { it } from "node:test";
import { describe } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { describe } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { describe } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { describe } from "node:test";
import { describe } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { describe } from "node:test";
import { it } from "node:test";
import { describe } from "node:test";
import { beforeEach } from "node:test";
import { describe } from "node:test";

// Mock the API
vi.mock("../../services/api", () => ({
  snippetAPI: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Import after mocking
const { snippetAPI } = await import("../../services/api");
const mockSnippetAPI = snippetAPI as any;

describe("snippetsSlice", () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        snippets: snippetsReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false, // Disable for tests
        }),
    });
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const state = store.getState().snippets;
      expect(state).toEqual({
        items: [],
        loading: false,
        error: null,
        selectedIds: [],
      });
    });
  });

  describe("synchronous actions", () => {
    it("should handle setSelectedIds", () => {
      store.dispatch(setSelectedIds(["1", "2", "3"]));
      const state = store.getState().snippets;
      expect(state.selectedIds).toEqual(["1", "2", "3"]);
    });

    it("should handle toggleSelection - add new id", () => {
      store.dispatch(toggleSelection("1"));
      const state = store.getState().snippets;
      expect(state.selectedIds).toEqual(["1"]);
    });

    it("should handle toggleSelection - remove existing id", () => {
      store.dispatch(setSelectedIds(["1", "2"]));
      store.dispatch(toggleSelection("1"));
      const state = store.getState().snippets;
      expect(state.selectedIds).toEqual(["2"]);
    });

    it("should handle clearSelection", () => {
      store.dispatch(setSelectedIds(["1", "2"]));
      store.dispatch(clearSelection());
      const state = store.getState().snippets;
      expect(state.selectedIds).toEqual([]);
    });

    it("should handle clearError", () => {
      // First set an error state
      store.dispatch({
        type: "snippets/fetchSnippets/rejected",
        error: { message: "Test error" },
      });
      expect(store.getState().snippets.error).toBe("Test error");

      store.dispatch(clearError());
      const state = store.getState().snippets;
      expect(state.error).toBeNull();
    });
  });

  describe("async actions", () => {
    const mockSnippet = {
      id: "1",
      title: "Test Snippet",
      description: "Test Description",
      code: 'console.log("test");',
      language: "javascript",
      tags: ["test"],
      category: "testing",
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    };

    describe("fetchSnippets", () => {
      it("should handle successful fetch", async () => {
        mockSnippetAPI.getAll.mockResolvedValue([mockSnippet]);

        await store.dispatch(fetchSnippets());
        const state = store.getState().snippets;

        expect(state.loading).toBe(false);
        expect(state.items).toEqual([mockSnippet]);
        expect(state.error).toBeNull();
      });

      it("should handle fetch error", async () => {
        mockSnippetAPI.getAll.mockRejectedValue(new Error("Fetch failed"));

        await store.dispatch(fetchSnippets());
        const state = store.getState().snippets;

        expect(state.loading).toBe(false);
        expect(state.items).toEqual([]);
        expect(state.error).toBe("Fetch failed");
      });

      it("should set loading state during fetch", () => {
        mockSnippetAPI.getAll.mockImplementation(() => new Promise(() => {})); // Never resolves

        store.dispatch(fetchSnippets());
        const state = store.getState().snippets;

        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
      });
    });

    describe("createSnippet", () => {
      it("should handle successful creation", async () => {
        const newSnippetData = {
          title: "New Snippet",
          description: "New Description",
          code: 'console.log("new");',
          language: "javascript",
          tags: ["new"],
          category: "testing",
        };

        mockSnippetAPI.create.mockResolvedValue(mockSnippet);

        await store.dispatch(createSnippet(newSnippetData));
        const state = store.getState().snippets;

        expect(state.items).toContain(mockSnippet);
        expect(state.error).toBeNull();
      });

      it("should handle creation error", async () => {
        const newSnippetData = {
          title: "New Snippet",
          description: "New Description",
          code: 'console.log("new");',
          language: "javascript",
          tags: ["new"],
          category: "testing",
        };

        mockSnippetAPI.create.mockRejectedValue(new Error("Creation failed"));

        await store.dispatch(createSnippet(newSnippetData));
        const state = store.getState().snippets;

        expect(state.error).toBe("Creation failed");
      });
    });

    describe("updateSnippet", () => {
      it("should handle successful update", async () => {
        // First add a snippet to the store
        store.dispatch({
          type: "snippets/fetchSnippets/fulfilled",
          payload: [mockSnippet],
        });

        const updatedSnippet = { ...mockSnippet, title: "Updated Title" };
        mockSnippetAPI.update.mockResolvedValue(updatedSnippet);

        await store.dispatch(
          updateSnippet({ id: "1", updates: { title: "Updated Title" } })
        );
        const state = store.getState().snippets;

        expect(state.items[0].title).toBe("Updated Title");
        expect(state.error).toBeNull();
      });

      it("should handle update error", async () => {
        mockSnippetAPI.update.mockRejectedValue(new Error("Update failed"));

        await store.dispatch(
          updateSnippet({ id: "1", updates: { title: "Updated Title" } })
        );
        const state = store.getState().snippets;

        expect(state.error).toBe("Update failed");
      });
    });

    describe("deleteSnippet", () => {
      it("should handle successful deletion", async () => {
        // First add snippets to the store
        store.dispatch({
          type: "snippets/fetchSnippets/fulfilled",
          payload: [mockSnippet],
        });
        store.dispatch(setSelectedIds(["1"]));

        mockSnippetAPI.delete.mockResolvedValue(undefined);

        await store.dispatch(deleteSnippet("1"));
        const state = store.getState().snippets;

        expect(state.items).toHaveLength(0);
        expect(state.selectedIds).toEqual([]);
        expect(state.error).toBeNull();
      });

      it("should handle deletion error", async () => {
        mockSnippetAPI.delete.mockRejectedValue(new Error("Deletion failed"));

        await store.dispatch(deleteSnippet("1"));
        const state = store.getState().snippets;

        expect(state.error).toBe("Deletion failed");
      });
    });
  });
});
