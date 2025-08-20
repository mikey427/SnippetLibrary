/**
 * Web GUI Preferences Service
 * Manages client-side preferences and theming for the web GUI
 */

export interface WebGUIPreferences {
  theme: "auto" | "light" | "dark";
  language: string;
  itemsPerPage: number;
  defaultView: "grid" | "list";
  showPreview: boolean;
  autoSave: boolean;
  confirmDelete: boolean;
  enableAnimations: boolean;
  compactMode: boolean;
  fontSize: "small" | "medium" | "large";
  codeTheme: string;
  searchSettings: {
    fuzzySearch: boolean;
    caseSensitive: boolean;
    highlightMatches: boolean;
    rememberFilters: boolean;
  };
  editorSettings: {
    tabSize: number;
    wordWrap: boolean;
    lineNumbers: boolean;
    minimap: boolean;
  };
}

export class PreferencesService {
  private static readonly STORAGE_KEY = "snippetLibrary.webGUI.preferences";
  private preferences: WebGUIPreferences;
  private listeners: Set<(preferences: WebGUIPreferences) => void> = new Set();

  constructor() {
    this.preferences = this.loadPreferences();
    this.applyTheme();
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): WebGUIPreferences {
    return {
      theme: "auto",
      language: "en",
      itemsPerPage: 20,
      defaultView: "grid",
      showPreview: true,
      autoSave: true,
      confirmDelete: true,
      enableAnimations: true,
      compactMode: false,
      fontSize: "medium",
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
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): WebGUIPreferences {
    try {
      const stored = localStorage.getItem(PreferencesService.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...this.getDefaultPreferences(), ...parsed };
      }
    } catch (error) {
      console.warn("Failed to load preferences from localStorage:", error);
    }
    return this.getDefaultPreferences();
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem(
        PreferencesService.STORAGE_KEY,
        JSON.stringify(this.preferences)
      );
    } catch (error) {
      console.error("Failed to save preferences to localStorage:", error);
    }
  }

  /**
   * Get current preferences
   */
  getPreferences(): WebGUIPreferences {
    return { ...this.preferences };
  }

  /**
   * Update preferences
   */
  updatePreferences(updates: Partial<WebGUIPreferences>): void {
    const oldTheme = this.preferences.theme;
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();

    // Apply theme if it changed
    if (updates.theme && updates.theme !== oldTheme) {
      this.applyTheme();
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Reset preferences to defaults
   */
  resetToDefaults(): void {
    this.preferences = this.getDefaultPreferences();
    this.savePreferences();
    this.applyTheme();
    this.notifyListeners();
  }

  /**
   * Get specific preference value
   */
  get<K extends keyof WebGUIPreferences>(key: K): WebGUIPreferences[K] {
    return this.preferences[key];
  }

  /**
   * Set specific preference value
   */
  set<K extends keyof WebGUIPreferences>(
    key: K,
    value: WebGUIPreferences[K]
  ): void {
    this.updatePreferences({ [key]: value } as Partial<WebGUIPreferences>);
  }

  /**
   * Apply theme to the document
   */
  private applyTheme(): void {
    const theme = this.resolveTheme();
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.className = `theme-${theme}`;

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        "content",
        theme === "dark" ? "#1e1e1e" : "#ffffff"
      );
    }
  }

  /**
   * Resolve auto theme to actual theme
   */
  private resolveTheme(): "light" | "dark" {
    if (this.preferences.theme === "auto") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return this.preferences.theme;
  }

  /**
   * Get current resolved theme
   */
  getCurrentTheme(): "light" | "dark" {
    return this.resolveTheme();
  }

  /**
   * Listen for system theme changes
   */
  private setupThemeListener(): void {
    if (this.preferences.theme === "auto") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", () => {
        if (this.preferences.theme === "auto") {
          this.applyTheme();
          this.notifyListeners();
        }
      });
    }
  }

  /**
   * Subscribe to preference changes
   */
  subscribe(listener: (preferences: WebGUIPreferences) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of preference changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getPreferences());
      } catch (error) {
        console.error("Error in preferences listener:", error);
      }
    });
  }

  /**
   * Export preferences as JSON
   */
  exportPreferences(): string {
    return JSON.stringify(this.preferences, null, 2);
  }

  /**
   * Import preferences from JSON
   */
  importPreferences(json: string): void {
    try {
      const imported = JSON.parse(json) as Partial<WebGUIPreferences>;
      this.updatePreferences(imported);
    } catch (error) {
      throw new Error(
        `Failed to import preferences: ${
          error instanceof Error ? error.message : "Invalid JSON"
        }`
      );
    }
  }

  /**
   * Validate preferences object
   */
  validatePreferences(preferences: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (
      preferences.theme &&
      !["auto", "light", "dark"].includes(preferences.theme)
    ) {
      errors.push("Invalid theme. Must be 'auto', 'light', or 'dark'.");
    }

    if (
      preferences.itemsPerPage &&
      (typeof preferences.itemsPerPage !== "number" ||
        preferences.itemsPerPage < 5 ||
        preferences.itemsPerPage > 100)
    ) {
      errors.push("Invalid itemsPerPage. Must be a number between 5 and 100.");
    }

    if (
      preferences.defaultView &&
      !["grid", "list"].includes(preferences.defaultView)
    ) {
      errors.push("Invalid defaultView. Must be 'grid' or 'list'.");
    }

    if (
      preferences.fontSize &&
      !["small", "medium", "large"].includes(preferences.fontSize)
    ) {
      errors.push("Invalid fontSize. Must be 'small', 'medium', or 'large'.");
    }

    if (
      preferences.editorSettings?.tabSize &&
      (typeof preferences.editorSettings.tabSize !== "number" ||
        preferences.editorSettings.tabSize < 1 ||
        preferences.editorSettings.tabSize > 8)
    ) {
      errors.push("Invalid tabSize. Must be a number between 1 and 8.");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Initialize preferences service
   */
  initialize(): void {
    this.setupThemeListener();

    // Apply initial theme
    this.applyTheme();

    // Apply other preferences
    this.applyFontSize();
    this.applyCompactMode();
    this.applyAnimations();
  }

  /**
   * Apply font size preference
   */
  private applyFontSize(): void {
    document.documentElement.style.setProperty(
      "--font-size-multiplier",
      this.preferences.fontSize === "small"
        ? "0.9"
        : this.preferences.fontSize === "large"
        ? "1.1"
        : "1.0"
    );
  }

  /**
   * Apply compact mode preference
   */
  private applyCompactMode(): void {
    document.documentElement.classList.toggle(
      "compact-mode",
      this.preferences.compactMode
    );
  }

  /**
   * Apply animations preference
   */
  private applyAnimations(): void {
    document.documentElement.classList.toggle(
      "no-animations",
      !this.preferences.enableAnimations
    );
  }
}

// Create singleton instance
export const preferencesService = new PreferencesService();
