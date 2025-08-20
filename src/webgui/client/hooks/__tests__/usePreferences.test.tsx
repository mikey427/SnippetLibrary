import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePreferences, usePreference, useTheme } from "../usePreferences";
import { preferencesService } from "../../services/PreferencesService";
import { window } from "vscode";

// Mock the preferences service
vi.mock("../../services/PreferencesService", () => {
  const mockService = {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    resetToDefaults: vi.fn(),
    exportPreferences: vi.fn(),
    importPreferences: vi.fn(),
    getCurrentTheme: vi.fn(),
    subscribe: vi.fn(),
  };

  return {
    preferencesService: mockService,
  };
});

// Mock matchMedia for theme tests
const mockMatchMedia = vi.fn();
Object.defineProperty(window, "matchMedia", {
  value: mockMatchMedia,
});

describe("usePreferences", () => {
  const mockPreferences = {
    theme: "auto" as const,
    language: "en",
    itemsPerPage: 20,
    defaultView: "grid" as const,
    showPreview: true,
    autoSave: true,
    confirmDelete: true,
    enableAnimations: true,
    compactMode: false,
    fontSize: "medium" as const,
    codeTheme: "vs-dark",
    searchSettings: {
      fuzzySearch: true,
      caseSensitive: false,
      highlightMatches: true,
      rememberFilters: true,
    },
    editorSettings: {
      tabSize: 2,
      wordWrap: true,
      lineNumbers: true,
      minimap: false,
    },
  };

  beforeEach(() => {
    vi.mocked(preferencesService.getPreferences).mockReturnValue(
      mockPreferences
    );
    vi.mocked(preferencesService.getCurrentTheme).mockReturnValue("light");
    vi.mocked(preferencesService.subscribe).mockImplementation((callback) => {
      // Return unsubscribe function
      return () => {};
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("usePreferences hook", () => {
    it("should return current preferences", () => {
      const { result } = renderHook(() => usePreferences());

      expect(result.current.preferences).toEqual(mockPreferences);
    });

    it("should provide updatePreferences function", () => {
      const { result } = renderHook(() => usePreferences());

      act(() => {
        result.current.updatePreferences({ theme: "dark" });
      });

      expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
        theme: "dark",
      });
    });

    it("should provide resetToDefaults function", () => {
      const { result } = renderHook(() => usePreferences());

      act(() => {
        result.current.resetToDefaults();
      });

      expect(preferencesService.resetToDefaults).toHaveBeenCalled();
    });

    it("should provide exportPreferences function", () => {
      vi.mocked(preferencesService.exportPreferences).mockReturnValue(
        '{"theme":"auto"}'
      );

      const { result } = renderHook(() => usePreferences());

      const exported = result.current.exportPreferences();

      expect(preferencesService.exportPreferences).toHaveBeenCalled();
      expect(exported).toBe('{"theme":"auto"}');
    });

    it("should provide importPreferences function", () => {
      const { result } = renderHook(() => usePreferences());

      act(() => {
        result.current.importPreferences('{"theme":"dark"}');
      });

      expect(preferencesService.importPreferences).toHaveBeenCalledWith(
        '{"theme":"dark"}'
      );
    });

    it("should provide getCurrentTheme function", () => {
      const { result } = renderHook(() => usePreferences());

      const theme = result.current.getCurrentTheme();

      expect(preferencesService.getCurrentTheme).toHaveBeenCalled();
      expect(theme).toBe("light");
    });

    it("should subscribe to preference changes", () => {
      renderHook(() => usePreferences());

      expect(preferencesService.subscribe).toHaveBeenCalled();
    });

    it("should unsubscribe on unmount", () => {
      const unsubscribe = vi.fn();
      vi.mocked(preferencesService.subscribe).mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => usePreferences());

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it("should update preferences when service notifies changes", () => {
      let subscribeCallback: (preferences: any) => void;
      vi.mocked(preferencesService.subscribe).mockImplementation((callback) => {
        subscribeCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => usePreferences());

      const newPreferences = { ...mockPreferences, theme: "dark" as const };

      act(() => {
        subscribeCallback(newPreferences);
      });

      expect(result.current.preferences.theme).toBe("dark");
    });
  });

  describe("usePreference hook", () => {
    it("should return specific preference value and setter", () => {
      const { result } = renderHook(() => usePreference("theme"));

      expect(result.current[0]).toBe("auto");
      expect(typeof result.current[1]).toBe("function");
    });

    it("should update specific preference when setter is called", () => {
      const { result } = renderHook(() => usePreference("theme"));

      act(() => {
        result.current[1]("dark");
      });

      expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
        theme: "dark",
      });
    });

    it("should work with nested preference objects", () => {
      const { result } = renderHook(() => usePreference("searchSettings"));

      expect(result.current[0]).toEqual(mockPreferences.searchSettings);

      const newSearchSettings = {
        ...mockPreferences.searchSettings,
        fuzzySearch: false,
      };

      act(() => {
        result.current[1](newSearchSettings);
      });

      expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
        searchSettings: newSearchSettings,
      });
    });
  });

  describe("useTheme hook", () => {
    let mockMediaQuery: any;

    beforeEach(() => {
      mockMediaQuery = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      mockMatchMedia.mockReturnValue(mockMediaQuery);
    });

    it("should return theme state and utilities", () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe("auto");
      expect(result.current.currentTheme).toBe("light");
      expect(result.current.isDark).toBe(false);
      expect(result.current.isLight).toBe(true);
      expect(result.current.isAuto).toBe(true);
      expect(typeof result.current.setTheme).toBe("function");
      expect(typeof result.current.toggleTheme).toBe("function");
      expect(typeof result.current.setAutoTheme).toBe("function");
    });

    it("should toggle theme between light and dark", () => {
      vi.mocked(preferencesService.getCurrentTheme).mockReturnValue("light");

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.toggleTheme();
      });

      expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
        theme: "dark",
      });
    });

    it("should toggle theme from dark to light", () => {
      vi.mocked(preferencesService.getCurrentTheme).mockReturnValue("dark");

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.toggleTheme();
      });

      expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
        theme: "light",
      });
    });

    it("should set theme to auto", () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setAutoTheme();
      });

      expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
        theme: "auto",
      });
    });

    it("should set specific theme", () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme("dark");
      });

      expect(preferencesService.updatePreferences).toHaveBeenCalledWith({
        theme: "dark",
      });
    });

    it("should listen for system theme changes", () => {
      renderHook(() => useTheme());

      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function)
      );
    });

    it("should remove system theme listener on unmount", () => {
      const { unmount } = renderHook(() => useTheme());

      unmount();

      expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function)
      );
    });

    it("should update current theme when system preference changes", () => {
      let mediaChangeHandler: () => void;
      mockMediaQuery.addEventListener.mockImplementation(
        (event: string, handler: () => void) => {
          if (event === "change") {
            mediaChangeHandler = handler;
          }
        }
      );

      const { result } = renderHook(() => useTheme());

      // Simulate system theme change
      vi.mocked(preferencesService.getCurrentTheme).mockReturnValue("dark");

      act(() => {
        mediaChangeHandler();
      });

      expect(result.current.currentTheme).toBe("dark");
      expect(result.current.isDark).toBe(true);
      expect(result.current.isLight).toBe(false);
    });

    it("should handle theme preference changes", () => {
      let subscribeCallback: (preferences: any) => void;
      vi.mocked(preferencesService.subscribe).mockImplementation((callback) => {
        subscribeCallback = callback;
        return () => {};
      });

      const { result } = renderHook(() => useTheme());

      // Simulate preference change to dark theme
      const newPreferences = { ...mockPreferences, theme: "dark" as const };
      vi.mocked(preferencesService.getCurrentTheme).mockReturnValue("dark");

      act(() => {
        subscribeCallback(newPreferences);
      });

      expect(result.current.theme).toBe("dark");
      expect(result.current.currentTheme).toBe("dark");
      expect(result.current.isDark).toBe(true);
      expect(result.current.isAuto).toBe(false);
    });
  });
});
