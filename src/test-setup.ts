import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock VS Code API globally
vi.mock("vscode", () => ({
  ExtensionContext: vi.fn(),
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn(),
    onDidChangeWindowState: vi.fn(() => ({ dispose: vi.fn() })),
    state: { focused: true },
    activeTextEditor: undefined,
    showInputBox: vi.fn(),
    showQuickPick: vi.fn(),
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  env: {
    openExternal: vi.fn(),
    clipboard: {
      writeText: vi.fn(),
    },
  },
  Uri: {
    parse: vi.fn((url: string) => ({ toString: () => url })),
  },
  ProgressLocation: {
    Notification: 15,
  },
  commands: {
    executeCommand: vi.fn(),
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: any) => defaultValue),
      update: vi.fn(),
    })),
    workspaceFolders: [],
    fs: {
      writeFile: vi.fn(),
      readFile: vi.fn(),
    },
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
}));

// Mock global objects that might be needed
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.confirm and other dialog methods
Object.defineProperty(window, "confirm", {
  writable: true,
  value: vi.fn().mockReturnValue(true),
});

Object.defineProperty(window, "alert", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(window, "prompt", {
  writable: true,
  value: vi.fn().mockReturnValue("test"),
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock Node.js modules for extension tests
vi.mock("http", () => ({
  request: vi.fn(),
}));

vi.mock("url", () => ({
  parse: vi.fn(),
}));
