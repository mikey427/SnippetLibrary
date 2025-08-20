import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PreferencesService, WebGUIPreferences } from "../PreferencesService";

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

// Mock matchMedia
const mockMatchMedia = vi.fn();
Object.defineProperty(window, "matchMedia", {
  value: mockMatchMedia,
});

// Mock document methods
const mockDocumentElement = {
  setAttribute: vi.fn(),
  style: {
    setProperty: vi.fn(),
  },
  classList: {
    toggle: vi.fn(),
  },
  className: "",
};

Object.defineProperty(document, "documentElement", {
  value: mockDocumentElement,
});

Object.defineProperty(document, "querySelector", {
  value: vi.fn(),
});

describe("PreferencesService", () => {
  let preferencesService: PreferencesService;
  let mockMediaQuery: any;

  beforeEach(() => {
    mockMediaQuery = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockMatchMedia.mockReturnValue(mockMediaQuery);
    mockLocalStorage.getItem.mockReturnValue(null);

    vi.clearAllMocks();

    preferencesService = new PreferencesService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default preferences when localStorage is empty", () => {
      const preferences = preferencesService.getPreferences();

      expect(preferences.theme).toBe("auto");
      expect(preferences.language).toBe("en");
      expect(preferences.itemsPerPage).toBe(20);
      expect(preferences.defaultView).toBe("grid");
      expect(preferences.showPreview).toBe(true);
      expect(preferences.autoSave).toBe(true);
      expect(preferences.confirmDelete).toBe(true);
      expect(preferences.enableAnimations).toBe(true);
      expect(preferences.compactMode).toBe(false);
      expect(preferences.fontSize).toBe("medium");
      expect(preferences.codeTheme).toBe("vs-dark");
    });

    it("should load preferences from localStorage when available", () => {
      const storedPreferences = {
        theme: "dark",
        itemsPerPage: 50,
        defaultView: "list",
        showPreview: false,
      };

      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify(storedPreferences)
      );

      const service = new PreferencesService();
      const preferences = service.getPreferences();

      expect(preferences.theme).toBe("dark");
      expect(preferences.itemsPerPage).toBe(50);
      expect(preferences.defaultView).toBe("list");
      expect(preferences.showPreview).toBe(false);
      // Should merge with defaults
      expect(preferences.language).toBe("en");
      expect(preferences.autoSave).toBe(true);
    });

    it("should handle corrupted localStorage data gracefully", () => {
      mockLocalStorage.getItem.mockReturnValue("invalid json");

      const service = new PreferencesService();
      const preferences = service.getPreferences();

      // Should fall back to defaults
      expect(preferences.theme).toBe("auto");
      expect(preferences.itemsPerPage).toBe(20);
    });
  });

  describe("updatePreferences", () => {
    it("should update preferences and save to localStorage", () => {
      const updates = {
        theme: "dark" as const,
        itemsPerPage: 30,
        showPreview: false,
      };

      preferencesService.updatePreferences(updates);
      const preferences = preferencesService.getPreferences();

      expect(preferences.theme).toBe("dark");
      expect(preferences.itemsPerPage).toBe(30);
      expect(preferences.showPreview).toBe(false);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it("should apply theme when theme is updated", () => {
      preferencesService.updatePreferences({ theme: "dark" });

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith(
        "data-theme",
        "dark"
      );
      expect(mockDocumentElement.className).toBe("theme-dark");
    });

    it("should notify listeners when preferences change", () => {
      const listener = vi.fn();
      preferencesService.subscribe(listener);

      preferencesService.updatePreferences({ theme: "light" });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "light" })
      );
    });
  });

  describe("resetToDefaults", () => {
    it("should reset all preferences to defaults", () => {
      // First update some preferences
      preferencesService.updatePreferences({
        theme: "dark",
        itemsPerPage: 50,
        showPreview: false,
      });

      // Then reset
      preferencesService.resetToDefaults();
      const preferences = preferencesService.getPreferences();

      expect(preferences.theme).toBe("auto");
      expect(preferences.itemsPerPage).toBe(20);
      expect(preferences.showPreview).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("get and set methods", () => {
    it("should get specific preference value", () => {
      const theme = preferencesService.get("theme");
      expect(theme).toBe("auto");
    });

    it("should set specific preference value", () => {
      preferencesService.set("itemsPerPage", 40);

      const itemsPerPage = preferencesService.get("itemsPerPage");
      expect(itemsPerPage).toBe(40);
    });
  });

  describe("theme resolution", () => {
    it("should resolve auto theme to light when system prefers light", () => {
      mockMediaQuery.matches = false; // prefers light

      const theme = preferencesService.getCurrentTheme();
      expect(theme).toBe("light");
    });

    it("should resolve auto theme to dark when system prefers dark", () => {
      mockMediaQuery.matches = true; // prefers dark

      const theme = preferencesService.getCurrentTheme();
      expect(theme).toBe("dark");
    });

    it("should return explicit theme when not auto", () => {
      preferencesService.updatePreferences({ theme: "dark" });

      const theme = preferencesService.getCurrentTheme();
      expect(theme).toBe("dark");
    });
  });

  describe("subscription management", () => {
    it("should add and remove listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsubscribe1 = preferencesService.subscribe(listener1);
      const unsubscribe2 = preferencesService.subscribe(listener2);

      preferencesService.updatePreferences({ theme: "dark" });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      // Unsubscribe first listener
      unsubscribe1();
      vi.clearAllMocks();

      preferencesService.updatePreferences({ theme: "light" });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      // Unsubscribe second listener
      unsubscribe2();
      vi.clearAllMocks();

      preferencesService.updatePreferences({ theme: "auto" });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it("should handle listener errors gracefully", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
      });
      const normalListener = vi.fn();

      preferencesService.subscribe(errorListener);
      preferencesService.subscribe(normalListener);

      // Should not throw and should still call other listeners
      expect(() => {
        preferencesService.updatePreferences({ theme: "dark" });
      }).not.toThrow();

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe("import/export", () => {
    it("should export preferences as JSON", () => {
      preferencesService.updatePreferences({
        theme: "dark",
        itemsPerPage: 30,
        showPreview: false,
      });

      const exported = preferencesService.exportPreferences();
      const parsed = JSON.parse(exported);

      expect(parsed.theme).toBe("dark");
      expect(parsed.itemsPerPage).toBe(30);
      expect(parsed.showPreview).toBe(false);
    });

    it("should import preferences from JSON", () => {
      const importData = {
        theme: "light",
        itemsPerPage: 25,
        defaultView: "list",
        compactMode: true,
      };

      preferencesService.importPreferences(JSON.stringify(importData));
      const preferences = preferencesService.getPreferences();

      expect(preferences.theme).toBe("light");
      expect(preferences.itemsPerPage).toBe(25);
      expect(preferences.defaultView).toBe("list");
      expect(preferences.compactMode).toBe(true);
    });

    it("should throw error for invalid import JSON", () => {
      expect(() => {
        preferencesService.importPreferences("invalid json");
      }).toThrow("Failed to import preferences:");
    });
  });

  describe("validation", () => {
    it("should validate correct preferences", () => {
      const validPreferences = {
        theme: "dark",
        itemsPerPage: 25,
        defaultView: "grid",
        fontSize: "medium",
        editorSettings: {
          tabSize: 4,
        },
      };

      const result = preferencesService.validatePreferences(validPreferences);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid theme", () => {
      const invalidPreferences = {
        theme: "invalid",
      };

      const result = preferencesService.validatePreferences(invalidPreferences);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Invalid theme. Must be 'auto', 'light', or 'dark'."
      );
    });

    it("should detect invalid itemsPerPage", () => {
      const invalidPreferences = {
        itemsPerPage: 200, // Too high
      };

      const result = preferencesService.validatePreferences(invalidPreferences);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Invalid itemsPerPage. Must be a number between 5 and 100."
      );
    });

    it("should detect invalid defaultView", () => {
      const invalidPreferences = {
        defaultView: "invalid",
      };

      const result = preferencesService.validatePreferences(invalidPreferences);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Invalid defaultView. Must be 'grid' or 'list'."
      );
    });

    it("should detect invalid fontSize", () => {
      const invalidPreferences = {
        fontSize: "huge",
      };

      const result = preferencesService.validatePreferences(invalidPreferences);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Invalid fontSize. Must be 'small', 'medium', or 'large'."
      );
    });

    it("should detect invalid tabSize", () => {
      const invalidPreferences = {
        editorSettings: {
          tabSize: 10, // Too high
        },
      };

      const result = preferencesService.validatePreferences(invalidPreferences);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Invalid tabSize. Must be a number between 1 and 8."
      );
    });

    it("should detect multiple validation errors", () => {
      const invalidPreferences = {
        theme: "invalid",
        itemsPerPage: 200,
        defaultView: "invalid",
      };

      const result = preferencesService.validatePreferences(invalidPreferences);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe("initialize", () => {
    it("should apply initial settings", () => {
      preferencesService.initialize();

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith(
        "data-theme",
        "light"
      );
      expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith(
        "--font-size-multiplier",
        "1.0"
      );
      expect(mockDocumentElement.classList.toggle).toHaveBeenCalledWith(
        "compact-mode",
        false
      );
      expect(mockDocumentElement.classList.toggle).toHaveBeenCalledWith(
        "no-animations",
        false
      );
    });

    it("should apply compact mode when enabled", () => {
      preferencesService.updatePreferences({ compactMode: true });
      preferencesService.initialize();

      expect(mockDocumentElement.classList.toggle).toHaveBeenCalledWith(
        "compact-mode",
        true
      );
    });

    it("should apply large font size", () => {
      preferencesService.updatePreferences({ fontSize: "large" });
      preferencesService.initialize();

      expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith(
        "--font-size-multiplier",
        "1.1"
      );
    });

    it("should apply small font size", () => {
      preferencesService.updatePreferences({ fontSize: "small" });
      preferencesService.initialize();

      expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith(
        "--font-size-multiplier",
        "0.9"
      );
    });

    it("should disable animations when preference is false", () => {
      preferencesService.updatePreferences({ enableAnimations: false });
      preferencesService.initialize();

      expect(mockDocumentElement.classList.toggle).toHaveBeenCalledWith(
        "no-animations",
        true
      );
    });
  });

  describe("localStorage error handling", () => {
    it("should handle localStorage setItem errors", () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error("Storage quota exceeded");
      });

      // Should not throw
      expect(() => {
        preferencesService.updatePreferences({ theme: "dark" });
      }).not.toThrow();
    });

    it("should handle localStorage getItem errors", () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error("Storage access denied");
      });

      // Should fall back to defaults
      const service = new PreferencesService();
      const preferences = service.getPreferences();

      expect(preferences.theme).toBe("auto");
    });
  });
});
