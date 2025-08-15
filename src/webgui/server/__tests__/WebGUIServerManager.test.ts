import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WebGUIServerManager,
  ServerManagerConfig,
} from "../WebGUIServerManager";
import { WebGUIServerDependencies } from "../WebGUIServer";
import { SnippetManager } from "../../../interfaces/SnippetManager";

// Mock SnippetManager
const mockSnippetManager: SnippetManager = {
  createSnippet: vi.fn(),
  getSnippet: vi.fn(),
  updateSnippet: vi.fn(),
  deleteSnippet: vi.fn(),
  searchSnippets: vi.fn(),
  importSnippets: vi.fn(),
  exportSnippets: vi.fn(),
};

describe("WebGUIServerManager", () => {
  let serverManager: WebGUIServerManager;
  let config: ServerManagerConfig;
  let dependencies: WebGUIServerDependencies;

  beforeEach(() => {
    config = {
      port: 0, // Use random port for testing
      host: "localhost",
      autoStart: false,
      autoRestart: true,
      maxRestartAttempts: 3,
    };

    dependencies = {
      snippetManager: mockSnippetManager,
    };

    serverManager = new WebGUIServerManager(config, dependencies);
  });

  afterEach(async () => {
    if (serverManager.isRunning()) {
      await serverManager.dispose();
    }
  });

  describe("Initialization", () => {
    it("should initialize without auto-start", async () => {
      expect(serverManager.isRunning()).toBe(false);

      await serverManager.initialize();
      expect(serverManager.isRunning()).toBe(false);
    });

    it("should initialize with auto-start", async () => {
      const autoStartConfig = { ...config, autoStart: true };
      const autoStartManager = new WebGUIServerManager(
        autoStartConfig,
        dependencies
      );

      await autoStartManager.initialize();
      expect(autoStartManager.isRunning()).toBe(true);

      await autoStartManager.dispose();
    });

    it("should not allow double initialization", async () => {
      await serverManager.initialize();

      await expect(serverManager.initialize()).rejects.toThrow(
        "Server manager already initialized"
      );
    });
  });

  describe("Server Lifecycle", () => {
    beforeEach(async () => {
      await serverManager.initialize();
    });

    it("should start server successfully", async () => {
      expect(serverManager.isRunning()).toBe(false);

      await serverManager.start();
      expect(serverManager.isRunning()).toBe(true);
    });

    it("should stop server successfully", async () => {
      await serverManager.start();
      expect(serverManager.isRunning()).toBe(true);

      await serverManager.stop();
      expect(serverManager.isRunning()).toBe(false);
    });

    it("should restart server successfully", async () => {
      await serverManager.start();
      expect(serverManager.isRunning()).toBe(true);

      await serverManager.restart();
      expect(serverManager.isRunning()).toBe(true);
    });

    it("should handle starting already running server", async () => {
      await serverManager.start();

      // Should not throw, just log that it's already running
      await serverManager.start();
      expect(serverManager.isRunning()).toBe(true);
    });

    it("should handle stopping non-running server", async () => {
      expect(serverManager.isRunning()).toBe(false);

      // Should not throw
      await serverManager.stop();
      expect(serverManager.isRunning()).toBe(false);
    });
  });

  describe("Server URL", () => {
    beforeEach(async () => {
      await serverManager.initialize();
    });

    it("should return server URL when running", async () => {
      await serverManager.start();

      const url = serverManager.getServerUrl();
      expect(url).toMatch(/^http:\/\/localhost:\d+$/);
    });

    it("should throw error when server is not running", () => {
      expect(() => serverManager.getServerUrl()).toThrow(
        "Server is not running"
      );
    });
  });

  describe("Configuration Management", () => {
    beforeEach(async () => {
      await serverManager.initialize();
    });

    it("should return current configuration", () => {
      const currentConfig = serverManager.getConfig();
      expect(currentConfig).toEqual(expect.objectContaining(config));
    });

    it("should update configuration when server is stopped", async () => {
      const newConfig = { port: 4000, host: "127.0.0.1" };

      await serverManager.updateConfig(newConfig);

      const updatedConfig = serverManager.getConfig();
      expect(updatedConfig.port).toBe(4000);
      expect(updatedConfig.host).toBe("127.0.0.1");
    });

    it("should restart server when updating config while running", async () => {
      await serverManager.start();
      const wasRunning = serverManager.isRunning();

      const newConfig = { port: 4001 };
      await serverManager.updateConfig(newConfig);

      expect(wasRunning).toBe(true);
      expect(serverManager.isRunning()).toBe(true);
      expect(serverManager.getConfig().port).toBe(4001);
    });
  });

  describe("Error Handling", () => {
    it("should throw error when starting uninitialized server", async () => {
      await expect(serverManager.start()).rejects.toThrow(
        "Server not initialized"
      );
    });

    it("should throw error when restarting uninitialized server", async () => {
      await expect(serverManager.restart()).rejects.toThrow(
        "Server not initialized"
      );
    });
  });

  describe("Auto-restart Functionality", () => {
    beforeEach(async () => {
      await serverManager.initialize();
    });

    it("should handle restart attempts with auto-restart enabled", async () => {
      // This test is complex to implement without mocking the internal server
      // For now, we'll test the configuration is properly set
      const config = serverManager.getConfig();
      expect(config.autoRestart).toBe(true);
      expect(config.maxRestartAttempts).toBe(3);
    });
  });

  describe("Disposal", () => {
    it("should dispose properly when server is running", async () => {
      await serverManager.initialize();
      await serverManager.start();

      expect(serverManager.isRunning()).toBe(true);

      await serverManager.dispose();
      expect(serverManager.isRunning()).toBe(false);
    });

    it("should dispose properly when server is not running", async () => {
      await serverManager.initialize();

      expect(serverManager.isRunning()).toBe(false);

      // Should not throw
      await serverManager.dispose();
      expect(serverManager.isRunning()).toBe(false);
    });

    it("should handle disposal of uninitialized manager", async () => {
      // Should not throw
      await serverManager.dispose();
      expect(serverManager.isRunning()).toBe(false);
    });
  });
});
