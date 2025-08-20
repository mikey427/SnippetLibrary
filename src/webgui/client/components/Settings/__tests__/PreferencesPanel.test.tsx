import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferencesPanel } from "../PreferencesPanel";
import { File } from "buffer";

// Mock the usePreferences hook
const mockUsePreferences = {
  preferences: {
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
  },
  updatePreferences: vi.fn(),
  resetToDefaults: vi.fn(),
  exportPreferences: vi.fn(),
  importPreferences: vi.fn(),
};

vi.mock("../../../hooks/usePreferences", () => ({
  usePreferences: () => mockUsePreferences,
}));

// Mock URL.createObjectURL and related APIs
global.URL.createObjectURL = vi.fn(() => "mock-url");
global.URL.revokeObjectURL = vi.fn();

// Mock document.createElement for download functionality
const mockAnchorElement = {
  href: "",
  download: "",
  click: vi.fn(),
};

const originalCreateElement = document.createElement;
document.createElement = vi.fn((tagName) => {
  if (tagName === "a") {
    return mockAnchorElement as any;
  }
  return originalCreateElement.call(document, tagName);
});

// Mock document.body methods
document.body.appendChild = vi.fn();
document.body.removeChild = vi.fn();

describe("PreferencesPanel", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePreferences.exportPreferences.mockReturnValue('{"theme":"auto"}');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render preferences panel with all sections", () => {
      render(<PreferencesPanel />);

      expect(screen.getByText("Preferences")).toBeInTheDocument();
      expect(screen.getByText("Appearance")).toBeInTheDocument();
      expect(screen.getByText("Behavior")).toBeInTheDocument();
      expect(screen.getByText("Search")).toBeInTheDocument();
      expect(screen.getByText("Code Editor")).toBeInTheDocument();
      expect(screen.getByText("Import/Export")).toBeInTheDocument();
    });

    it("should render close button when onClose is provided", () => {
      const onClose = vi.fn();
      render(<PreferencesPanel onClose={onClose} />);

      const closeButton = screen.getByLabelText("Close");
      expect(closeButton).toBeInTheDocument();
    });

    it("should not render close button when onClose is not provided", () => {
      render(<PreferencesPanel />);

      const closeButton = screen.queryByLabelText("Close");
      expect(closeButton).not.toBeInTheDocument();
    });

    it("should display current preference values", () => {
      render(<PreferencesPanel />);

      // Check theme radio buttons
      expect(screen.getByDisplayValue("auto")).toBeChecked();
      expect(screen.getByDisplayValue("light")).not.toBeChecked();
      expect(screen.getByDisplayValue("dark")).not.toBeChecked();

      // Check other preferences
      expect(screen.getByDisplayValue("20")).toBeInTheDocument(); // itemsPerPage
      expect(screen.getByDisplayValue("grid")).toBeChecked();
      expect(screen.getByDisplayValue("medium")).toBeInTheDocument(); // fontSize
    });
  });

  describe("theme selection", () => {
    it("should update theme when radio button is clicked", async () => {
      render(<PreferencesPanel />);

      const darkThemeRadio = screen.getByDisplayValue("dark");
      await user.click(darkThemeRadio);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        theme: "dark",
      });
    });

    it("should update theme to light", async () => {
      render(<PreferencesPanel />);

      const lightThemeRadio = screen.getByDisplayValue("light");
      await user.click(lightThemeRadio);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        theme: "light",
      });
    });
  });

  describe("appearance settings", () => {
    it("should update font size", async () => {
      render(<PreferencesPanel />);

      const fontSizeSelect = screen.getByDisplayValue("medium");
      await user.selectOptions(fontSizeSelect, "large");

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        fontSize: "large",
      });
    });

    it("should update default view", async () => {
      render(<PreferencesPanel />);

      const listViewRadio = screen.getByDisplayValue("list");
      await user.click(listViewRadio);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        defaultView: "list",
      });
    });

    it("should toggle compact mode", async () => {
      render(<PreferencesPanel />);

      const compactModeCheckbox = screen.getByLabelText("Compact Mode");
      await user.click(compactModeCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        compactMode: true,
      });
    });

    it("should toggle animations", async () => {
      render(<PreferencesPanel />);

      const animationsCheckbox = screen.getByLabelText("Enable Animations");
      await user.click(animationsCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        enableAnimations: false,
      });
    });
  });

  describe("behavior settings", () => {
    it("should update items per page", async () => {
      render(<PreferencesPanel />);

      const itemsPerPageInput = screen.getByDisplayValue("20");
      await user.clear(itemsPerPageInput);
      await user.type(itemsPerPageInput, "50");

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        itemsPerPage: 50,
      });
    });

    it("should toggle show preview", async () => {
      render(<PreferencesPanel />);

      const showPreviewCheckbox = screen.getByLabelText("Show Code Preview");
      await user.click(showPreviewCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        showPreview: false,
      });
    });

    it("should toggle auto save", async () => {
      render(<PreferencesPanel />);

      const autoSaveCheckbox = screen.getByLabelText("Auto Save Changes");
      await user.click(autoSaveCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        autoSave: false,
      });
    });

    it("should toggle confirm delete", async () => {
      render(<PreferencesPanel />);

      const confirmDeleteCheckbox = screen.getByLabelText(
        "Confirm Before Delete"
      );
      await user.click(confirmDeleteCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        confirmDelete: false,
      });
    });
  });

  describe("search settings", () => {
    it("should toggle fuzzy search", async () => {
      render(<PreferencesPanel />);

      const fuzzySearchCheckbox = screen.getByLabelText("Fuzzy Search");
      await user.click(fuzzySearchCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        searchSettings: {
          ...mockUsePreferences.preferences.searchSettings,
          fuzzySearch: false,
        },
      });
    });

    it("should toggle case sensitive search", async () => {
      render(<PreferencesPanel />);

      const caseSensitiveCheckbox = screen.getByLabelText("Case Sensitive");
      await user.click(caseSensitiveCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        searchSettings: {
          ...mockUsePreferences.preferences.searchSettings,
          caseSensitive: true,
        },
      });
    });

    it("should toggle highlight matches", async () => {
      render(<PreferencesPanel />);

      const highlightMatchesCheckbox =
        screen.getByLabelText("Highlight Matches");
      await user.click(highlightMatchesCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        searchSettings: {
          ...mockUsePreferences.preferences.searchSettings,
          highlightMatches: false,
        },
      });
    });

    it("should toggle remember filters", async () => {
      render(<PreferencesPanel />);

      const rememberFiltersCheckbox = screen.getByLabelText("Remember Filters");
      await user.click(rememberFiltersCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        searchSettings: {
          ...mockUsePreferences.preferences.searchSettings,
          rememberFilters: false,
        },
      });
    });
  });

  describe("editor settings", () => {
    it("should update tab size", async () => {
      render(<PreferencesPanel />);

      const tabSizeInput = screen.getByDisplayValue("2");
      await user.clear(tabSizeInput);
      await user.type(tabSizeInput, "4");

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        editorSettings: {
          ...mockUsePreferences.preferences.editorSettings,
          tabSize: 4,
        },
      });
    });

    it("should update code theme", async () => {
      render(<PreferencesPanel />);

      const codeThemeSelect = screen.getByDisplayValue("vs-dark");
      await user.selectOptions(codeThemeSelect, "github");

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        codeTheme: "github",
      });
    });

    it("should toggle word wrap", async () => {
      render(<PreferencesPanel />);

      const wordWrapCheckbox = screen.getByLabelText("Word Wrap");
      await user.click(wordWrapCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        editorSettings: {
          ...mockUsePreferences.preferences.editorSettings,
          wordWrap: false,
        },
      });
    });

    it("should toggle line numbers", async () => {
      render(<PreferencesPanel />);

      const lineNumbersCheckbox = screen.getByLabelText("Line Numbers");
      await user.click(lineNumbersCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        editorSettings: {
          ...mockUsePreferences.preferences.editorSettings,
          lineNumbers: false,
        },
      });
    });

    it("should toggle minimap", async () => {
      render(<PreferencesPanel />);

      const minimapCheckbox = screen.getByLabelText("Minimap");
      await user.click(minimapCheckbox);

      expect(mockUsePreferences.updatePreferences).toHaveBeenCalledWith({
        editorSettings: {
          ...mockUsePreferences.preferences.editorSettings,
          minimap: true,
        },
      });
    });
  });

  describe("import/export functionality", () => {
    it("should export preferences when export button is clicked", async () => {
      render(<PreferencesPanel />);

      const exportButton = screen.getByText("Export Preferences");
      await user.click(exportButton);

      expect(mockUsePreferences.exportPreferences).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockAnchorElement.click).toHaveBeenCalled();
      expect(mockAnchorElement.download).toBe(
        "snippet-library-preferences.json"
      );
    });

    it("should open import dialog when import button is clicked", async () => {
      render(<PreferencesPanel />);

      const importButton = screen.getByText("Import Preferences");
      await user.click(importButton);

      expect(screen.getByText("Import Preferences")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Paste preferences JSON here...")
      ).toBeInTheDocument();
    });

    it("should close import dialog when cancel is clicked", async () => {
      render(<PreferencesPanel />);

      const importButton = screen.getByText("Import Preferences");
      await user.click(importButton);

      const cancelButton = screen.getByText("Cancel");
      await user.click(cancelButton);

      expect(screen.queryByText("Import Preferences")).not.toBeInTheDocument();
    });

    it("should import preferences from textarea", async () => {
      render(<PreferencesPanel />);

      const importButton = screen.getByText("Import Preferences");
      await user.click(importButton);

      const textarea = screen.getByPlaceholderText(
        "Paste preferences JSON here..."
      );
      const importJson = '{"theme":"dark","itemsPerPage":30}';
      await user.type(textarea, importJson);

      const importConfirmButton = screen.getByRole("button", {
        name: "Import",
      });
      await user.click(importConfirmButton);

      expect(mockUsePreferences.importPreferences).toHaveBeenCalledWith(
        importJson
      );
    });

    it("should handle import errors", async () => {
      mockUsePreferences.importPreferences.mockImplementation(() => {
        throw new Error("Invalid JSON format");
      });

      render(<PreferencesPanel />);

      const importButton = screen.getByText("Import Preferences");
      await user.click(importButton);

      const textarea = screen.getByPlaceholderText(
        "Paste preferences JSON here..."
      );
      await user.type(textarea, "invalid json");

      const importConfirmButton = screen.getByRole("button", {
        name: "Import",
      });
      await user.click(importConfirmButton);

      expect(screen.getByText("Invalid JSON format")).toBeInTheDocument();
    });

    it("should disable import button when textarea is empty", async () => {
      render(<PreferencesPanel />);

      const importButton = screen.getByText("Import Preferences");
      await user.click(importButton);

      const importConfirmButton = screen.getByRole("button", {
        name: "Import",
      });
      expect(importConfirmButton).toBeDisabled();
    });

    it("should reset to defaults when reset button is clicked", async () => {
      render(<PreferencesPanel />);

      const resetButton = screen.getByText("Reset to Defaults");
      await user.click(resetButton);

      expect(mockUsePreferences.resetToDefaults).toHaveBeenCalled();
    });
  });

  describe("close functionality", () => {
    it("should call onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      render(<PreferencesPanel onClose={onClose} />);

      const closeButton = screen.getByLabelText("Close");
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("file import", () => {
    it("should handle file selection for import", async () => {
      const fileContent = '{"theme":"dark"}';
      const file = new File([fileContent], "preferences.json", {
        type: "application/json",
      });

      render(<PreferencesPanel />);

      const importButton = screen.getByText("Import Preferences");
      await user.click(importButton);

      const fileInput = screen
        .getByLabelText("Choose File")
        .querySelector("input");
      expect(fileInput).toBeInTheDocument();

      // Mock FileReader
      const mockFileReader = {
        readAsText: vi.fn(),
        onload: null as any,
        result: fileContent,
      };

      global.FileReader = vi.fn(() => mockFileReader) as any;

      await user.upload(fileInput!, file);

      // Simulate file read completion
      mockFileReader.onload({ target: { result: fileContent } } as any);

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(
          "Paste preferences JSON here..."
        );
        expect(textarea).toHaveValue(fileContent);
      });
    });
  });

  describe("accessibility", () => {
    it("should have proper ARIA labels", () => {
      const onClose = vi.fn();
      render(<PreferencesPanel onClose={onClose} />);

      expect(screen.getByLabelText("Close")).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      render(<PreferencesPanel />);

      const firstRadio = screen.getByDisplayValue("auto");
      firstRadio.focus();

      expect(document.activeElement).toBe(firstRadio);
    });
  });
});
