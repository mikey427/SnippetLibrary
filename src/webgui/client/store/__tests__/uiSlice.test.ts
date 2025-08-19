import { configureStore } from "@reduxjs/toolkit";
import uiReducer, {
  setTheme,
  toggleSidebar,
  setSidebarOpen,
  setViewMode,
  addNotification,
  removeNotification,
  clearNotifications,
} from "../slices/uiSlice";

describe("uiSlice", () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        ui: uiReducer,
      },
    });
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const state = store.getState().ui;
      expect(state).toEqual({
        theme: "light",
        sidebarOpen: true,
        viewMode: "grid",
        notifications: [],
      });
    });
  });

  describe("theme actions", () => {
    it("should handle setTheme", () => {
      store.dispatch(setTheme("dark"));
      const state = store.getState().ui;
      expect(state.theme).toBe("dark");

      store.dispatch(setTheme("light"));
      expect(store.getState().ui.theme).toBe("light");
    });
  });

  describe("sidebar actions", () => {
    it("should handle toggleSidebar", () => {
      // Initial state is sidebarOpen: true
      store.dispatch(toggleSidebar());
      expect(store.getState().ui.sidebarOpen).toBe(false);

      store.dispatch(toggleSidebar());
      expect(store.getState().ui.sidebarOpen).toBe(true);
    });

    it("should handle setSidebarOpen", () => {
      store.dispatch(setSidebarOpen(false));
      expect(store.getState().ui.sidebarOpen).toBe(false);

      store.dispatch(setSidebarOpen(true));
      expect(store.getState().ui.sidebarOpen).toBe(true);
    });
  });

  describe("view mode actions", () => {
    it("should handle setViewMode", () => {
      store.dispatch(setViewMode("list"));
      expect(store.getState().ui.viewMode).toBe("list");

      store.dispatch(setViewMode("grid"));
      expect(store.getState().ui.viewMode).toBe("grid");
    });
  });

  describe("notification actions", () => {
    it("should handle addNotification", () => {
      const notification = {
        type: "success" as const,
        message: "Test notification",
      };

      store.dispatch(addNotification(notification));
      const state = store.getState().ui;

      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0]).toMatchObject({
        type: "success",
        message: "Test notification",
      });
      expect(state.notifications[0].id).toBeDefined();
      expect(state.notifications[0].timestamp).toBeDefined();
    });

    it("should generate unique ids for notifications", async () => {
      store.dispatch(addNotification({ type: "info", message: "First" }));
      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));
      store.dispatch(addNotification({ type: "info", message: "Second" }));

      const state = store.getState().ui;
      expect(state.notifications).toHaveLength(2);
      expect(state.notifications[0].id).not.toBe(state.notifications[1].id);
    });

    it("should handle removeNotification", () => {
      store.dispatch(addNotification({ type: "info", message: "Test" }));
      const state = store.getState().ui;
      const notificationId = state.notifications[0].id;

      store.dispatch(removeNotification(notificationId));
      const updatedState = store.getState().ui;
      expect(updatedState.notifications).toHaveLength(0);
    });

    it("should handle clearNotifications", () => {
      store.dispatch(addNotification({ type: "info", message: "First" }));
      store.dispatch(addNotification({ type: "info", message: "Second" }));

      expect(store.getState().ui.notifications).toHaveLength(2);

      store.dispatch(clearNotifications());
      expect(store.getState().ui.notifications).toHaveLength(0);
    });

    it("should handle different notification types", () => {
      const types = ["success", "error", "warning", "info"] as const;

      types.forEach((type, index) => {
        store.dispatch(addNotification({ type, message: `${type} message` }));
      });

      const state = store.getState().ui;
      expect(state.notifications).toHaveLength(4);

      types.forEach((type, index) => {
        expect(state.notifications[index].type).toBe(type);
        expect(state.notifications[index].message).toBe(`${type} message`);
      });
    });
  });
});
