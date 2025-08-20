import { vi } from "vitest";

export const ExtensionContext = vi.fn();

export const window = {
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
};

export const env = {
  openExternal: vi.fn(),
  clipboard: {
    writeText: vi.fn(),
  },
};

export const Uri = {
  parse: vi.fn((url: string) => ({ toString: () => url })),
};

export const ProgressLocation = {
  Notification: 15,
};

export const commands = {
  executeCommand: vi.fn(),
  registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
};

export const workspace = {
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
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};
