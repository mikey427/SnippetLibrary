import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebGUILauncher, WebGUILauncherConfig } from "../WebGUILauncher";
import { SnippetManager } from "../../interfaces/SnippetManager";

// Mock WebGUIServerManager
vi.mock("../../webgui/server/WebGUIServerManager", () => ({
  WebGUIServerManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue(undefined),
    isRunning: vi.fn().mockReturnValue(false),
    getServerUrl: vi.fn().mockReturnValue("http://localhost:3000"),
    updateConfig: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("WebGUILauncher", () => {
  let launcher: WebGUILauncher;
  let mockSnippetManager: SnippetManager;
  let config: WebGUILauncherConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock snippet manager
    mockSnippetManager = {} as SnippetManager;

    // Create test configuration
    config = {
      port: 3000,
      host: "localhost",
      autoStart: false,
      autoShutdown: true,
      openInBrowser: true,
      healthCheckInterval: 30000,
      maxStartupRetries: 3,
    };

    // Create launcher instance
    launcher = new WebGUILauncher(config, {
      snippetManager: mockSnippetManager,
    });
  });

  afterEach(async () => {
    if (launcher) {
      await launcher.dispose();
    }
  });

  describe("initialization", () => {
    it("should create launcher instance", () => {
      expect(launcher).toBeDefined();
    });

    it("should initialize successfully", async () => {
      await launcher.initialize();
      // If no error is thrown, initialization was successful
      expect(true).toBe(true);
    });
  });

  describe("server status", () => {
    beforeEach(async () => {
      await launcher.initialize();
    });

    it("should return server running status", () => {
      const isRunning = launcher.isServerRunning();
      expect(typeof isRunning).toBe("boolean");
    });

    it("should get server status when not running", async () => {
      const status = await launcher.getServerStatus();
      expect(status).toHaveProperty("running");
      expect(status.running).toBe(false);
    });
  });

  describe("configuration management", () => {
    beforeEach(async () => {
      await launcher.initialize();
    });

    it("should update configuration", async () => {
      const newConfig = {
        port: 4000,
        host: "0.0.0.0",
      };

      await launcher.updateConfig(newConfig);
      // If no error is thrown, update was successful
      expect(true).toBe(true);
    });
  });

  describe("disposal", () => {
    it("should dispose successfully", async () => {
      await launcher.initialize();
      await launcher.dispose();
      // If no error is thrown, disposal was successful
      expect(true).toBe(true);
    });

    it("should handle disposal when not initialized", async () => {
      await launcher.dispose();
      // If no error is thrown, disposal was successful
      expect(true).toBe(true);
    });
  });
});
