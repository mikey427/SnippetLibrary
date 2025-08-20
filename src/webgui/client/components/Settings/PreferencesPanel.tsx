import React, { useState } from "react";
import { usePreferences } from "../../hooks/usePreferences";
import { WebGUIPreferences } from "../../services/PreferencesService";
import "./PreferencesPanel.css";

interface PreferencesPanelProps {
  onClose?: () => void;
}

export const PreferencesPanel: React.FC<PreferencesPanelProps> = ({
  onClose,
}) => {
  const {
    preferences,
    updatePreferences,
    resetToDefaults,
    exportPreferences,
    importPreferences,
  } = usePreferences();

  const [importText, setImportText] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importError, setImportError] = useState("");

  const handleThemeChange = (theme: "auto" | "light" | "dark") => {
    updatePreferences({ theme });
  };

  const handleViewChange = (defaultView: "grid" | "list") => {
    updatePreferences({ defaultView });
  };

  const handleFontSizeChange = (fontSize: "small" | "medium" | "large") => {
    updatePreferences({ fontSize });
  };

  const handleSearchSettingsChange = (
    key: keyof WebGUIPreferences["searchSettings"],
    value: boolean
  ) => {
    updatePreferences({
      searchSettings: {
        ...preferences.searchSettings,
        [key]: value,
      },
    });
  };

  const handleEditorSettingsChange = (
    key: keyof WebGUIPreferences["editorSettings"],
    value: number | boolean
  ) => {
    updatePreferences({
      editorSettings: {
        ...preferences.editorSettings,
        [key]: value,
      },
    });
  };

  const handleExport = () => {
    const exported = exportPreferences();
    const blob = new Blob([exported], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "snippet-library-preferences.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      importPreferences(importText);
      setShowImportDialog(false);
      setImportText("");
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportText(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="preferences-panel">
      <div className="preferences-header">
        <h2>Preferences</h2>
        {onClose && (
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      <div className="preferences-content">
        {/* Appearance Section */}
        <section className="preference-section">
          <h3>Appearance</h3>

          <div className="preference-group">
            <label>Theme</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="theme"
                  value="auto"
                  checked={preferences.theme === "auto"}
                  onChange={() => handleThemeChange("auto")}
                />
                Auto
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={preferences.theme === "light"}
                  onChange={() => handleThemeChange("light")}
                />
                Light
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={preferences.theme === "dark"}
                  onChange={() => handleThemeChange("dark")}
                />
                Dark
              </label>
            </div>
          </div>

          <div className="preference-group">
            <label>Font Size</label>
            <select
              value={preferences.fontSize}
              onChange={(e) =>
                handleFontSizeChange(
                  e.target.value as "small" | "medium" | "large"
                )
              }
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div className="preference-group">
            <label>Default View</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="defaultView"
                  value="grid"
                  checked={preferences.defaultView === "grid"}
                  onChange={() => handleViewChange("grid")}
                />
                Grid
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="defaultView"
                  value="list"
                  checked={preferences.defaultView === "list"}
                  onChange={() => handleViewChange("list")}
                />
                List
              </label>
            </div>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.compactMode}
                onChange={(e) =>
                  updatePreferences({ compactMode: e.target.checked })
                }
              />
              Compact Mode
            </label>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.enableAnimations}
                onChange={(e) =>
                  updatePreferences({ enableAnimations: e.target.checked })
                }
              />
              Enable Animations
            </label>
          </div>
        </section>

        {/* Behavior Section */}
        <section className="preference-section">
          <h3>Behavior</h3>

          <div className="preference-group">
            <label>Items Per Page</label>
            <input
              type="number"
              min="5"
              max="100"
              value={preferences.itemsPerPage}
              onChange={(e) =>
                updatePreferences({ itemsPerPage: parseInt(e.target.value) })
              }
            />
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.showPreview}
                onChange={(e) =>
                  updatePreferences({ showPreview: e.target.checked })
                }
              />
              Show Code Preview
            </label>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.autoSave}
                onChange={(e) =>
                  updatePreferences({ autoSave: e.target.checked })
                }
              />
              Auto Save Changes
            </label>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.confirmDelete}
                onChange={(e) =>
                  updatePreferences({ confirmDelete: e.target.checked })
                }
              />
              Confirm Before Delete
            </label>
          </div>
        </section>

        {/* Search Section */}
        <section className="preference-section">
          <h3>Search</h3>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.searchSettings.fuzzySearch}
                onChange={(e) =>
                  handleSearchSettingsChange("fuzzySearch", e.target.checked)
                }
              />
              Fuzzy Search
            </label>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.searchSettings.caseSensitive}
                onChange={(e) =>
                  handleSearchSettingsChange("caseSensitive", e.target.checked)
                }
              />
              Case Sensitive
            </label>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.searchSettings.highlightMatches}
                onChange={(e) =>
                  handleSearchSettingsChange(
                    "highlightMatches",
                    e.target.checked
                  )
                }
              />
              Highlight Matches
            </label>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.searchSettings.rememberFilters}
                onChange={(e) =>
                  handleSearchSettingsChange(
                    "rememberFilters",
                    e.target.checked
                  )
                }
              />
              Remember Filters
            </label>
          </div>
        </section>

        {/* Editor Section */}
        <section className="preference-section">
          <h3>Code Editor</h3>

          <div className="preference-group">
            <label>Tab Size</label>
            <input
              type="number"
              min="1"
              max="8"
              value={preferences.editorSettings.tabSize}
              onChange={(e) =>
                handleEditorSettingsChange("tabSize", parseInt(e.target.value))
              }
            />
          </div>

          <div className="preference-group">
            <label>Code Theme</label>
            <select
              value={preferences.codeTheme}
              onChange={(e) => updatePreferences({ codeTheme: e.target.value })}
            >
              <option value="vs">Visual Studio</option>
              <option value="vs-dark">Visual Studio Dark</option>
              <option value="github">GitHub</option>
              <option value="monokai">Monokai</option>
              <option value="solarized-light">Solarized Light</option>
              <option value="solarized-dark">Solarized Dark</option>
            </select>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.editorSettings.wordWrap}
                onChange={(e) =>
                  handleEditorSettingsChange("wordWrap", e.target.checked)
                }
              />
              Word Wrap
            </label>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.editorSettings.lineNumbers}
                onChange={(e) =>
                  handleEditorSettingsChange("lineNumbers", e.target.checked)
                }
              />
              Line Numbers
            </label>
          </div>

          <div className="preference-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={preferences.editorSettings.minimap}
                onChange={(e) =>
                  handleEditorSettingsChange("minimap", e.target.checked)
                }
              />
              Minimap
            </label>
          </div>
        </section>

        {/* Import/Export Section */}
        <section className="preference-section">
          <h3>Import/Export</h3>

          <div className="preference-actions">
            <button className="secondary-button" onClick={handleExport}>
              Export Preferences
            </button>
            <button
              className="secondary-button"
              onClick={() => setShowImportDialog(true)}
            >
              Import Preferences
            </button>
            <button className="danger-button" onClick={resetToDefaults}>
              Reset to Defaults
            </button>
          </div>
        </section>
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Import Preferences</h3>
              <button onClick={() => setShowImportDialog(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="import-options">
                <label className="file-input-label">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    style={{ display: "none" }}
                  />
                  Choose File
                </label>
                <span>or paste JSON below:</span>
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste preferences JSON here..."
                rows={10}
              />
              {importError && (
                <div className="error-message">{importError}</div>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowImportDialog(false)}>Cancel</button>
              <button onClick={handleImport} disabled={!importText.trim()}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
