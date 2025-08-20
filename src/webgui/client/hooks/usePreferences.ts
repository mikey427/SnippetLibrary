import { useState, useEffect } from "react";
import {
  preferencesService,
  WebGUIPreferences,
} from "../services/PreferencesService";

/**
 * React hook for accessing and updating web GUI preferences
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState<WebGUIPreferences>(
    preferencesService.getPreferences()
  );

  useEffect(() => {
    // Subscribe to preference changes
    const unsubscribe = preferencesService.subscribe(setPreferences);
    return unsubscribe;
  }, []);

  const updatePreferences = (updates: Partial<WebGUIPreferences>) => {
    preferencesService.updatePreferences(updates);
  };

  const resetToDefaults = () => {
    preferencesService.resetToDefaults();
  };

  const exportPreferences = () => {
    return preferencesService.exportPreferences();
  };

  const importPreferences = (json: string) => {
    preferencesService.importPreferences(json);
  };

  const getCurrentTheme = () => {
    return preferencesService.getCurrentTheme();
  };

  return {
    preferences,
    updatePreferences,
    resetToDefaults,
    exportPreferences,
    importPreferences,
    getCurrentTheme,
  };
}

/**
 * Hook for accessing a specific preference value
 */
export function usePreference<K extends keyof WebGUIPreferences>(
  key: K
): [WebGUIPreferences[K], (value: WebGUIPreferences[K]) => void] {
  const { preferences, updatePreferences } = usePreferences();

  const setValue = (value: WebGUIPreferences[K]) => {
    updatePreferences({ [key]: value } as Partial<WebGUIPreferences>);
  };

  return [preferences[key], setValue];
}

/**
 * Hook for theme-specific functionality
 */
export function useTheme() {
  const [theme, setTheme] = usePreference("theme");
  const [currentTheme, setCurrentTheme] = useState(
    preferencesService.getCurrentTheme()
  );

  useEffect(() => {
    const updateCurrentTheme = () => {
      setCurrentTheme(preferencesService.getCurrentTheme());
    };

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateCurrentTheme);

    // Update current theme when preference changes
    updateCurrentTheme();

    return () => {
      mediaQuery.removeEventListener("change", updateCurrentTheme);
    };
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  };

  const setAutoTheme = () => {
    setTheme("auto");
  };

  return {
    theme,
    currentTheme,
    setTheme,
    toggleTheme,
    setAutoTheme,
    isDark: currentTheme === "dark",
    isLight: currentTheme === "light",
    isAuto: theme === "auto",
  };
}
