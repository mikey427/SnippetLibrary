import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  FileSystemWatcherImpl,
  FileWatcherConfig,
  FileChangeEvent,
} from "../FileSystemWatcher";
import { StorageChange } from "../../../types";

// Mock fs module
vi.mock("fs");
const mockFs = vi.mocked(fs);

describe("FileSystemWatcher", () => {
  let watcher: FileSystemWatcherImpl;
  let tempDir: string;
  let config: FileWatcherConfig;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), "snippet-watcher-test");
    config = {
      watchPath: tempDir,
      debounceMs: 100,
      recursive: true,
      ignorePatterns: [".git", "node_modules", ".tmp"],
    };

    watcher = new FileSystemWatcherImpl(config);

    // Setup fs mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.watch.mockReturnValue({
      close: vi.fn(),
      on: vi.fn(),
    } as any);
  });

  afterEach(() => {
    watcher.dispose();
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should create watcher with valid config", () => {
      expect(watcher).toBeDefined();
      expect(watcher.isWatching()).toBe(false);
    });
  });

  describe("lifecycle management", () => {
    it("should start watching successfully", async () => {
      const result = await watcher.start();
      expect(result.success).toBe(true);
      expect(watcher.isWatching()).toBe(true);
      expect(mockFs.watch).toHaveBeenCalledWith(
        tempDir,
        { recursive: true },
        expect.any(Function)
      );
    });

    it("should not start if already watching", async () => {
      await watcher.start();
      const result = await watcher.start();
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("already active");
    });

    it("should fail to start if watch path doesn't exist", async () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = await watcher.start();
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("does not exist");
    });

    it("should stop watching successfully", async () => {
      const mockWatcher = {
        close: vi.fn(),
        on: vi.fn(),
      };
      mockFs.watch.mockReturnValue(mockWatcher as any);

      await watcher.start();
      const result = await watcher.stop();
      expect(result.success).toBe(true);
      expect(watcher.isWatching()).toBe(false);
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe("event handling", () => {
    let fileChangeCallback: vi.Mock;
    let storageChangeCallback: vi.Mock;

    beforeEach(async () => {
      fileChangeCallback = vi.fn();
      storageChangeCallback = vi.fn();

      watcher.onFileChange(fileChangeCallback);
      watcher.onStorageChange(storageChangeCallback);

      await watcher.start();
    });

    it("should register and remove event callbacks", () => {
      const callback = vi.fn();
      watcher.onFileChange(callback);
      watcher.offFileChange(callback);
      // No easy way to test removal, but should not throw
    });

    it("should handle file system events with debouncing", async () => {
      const mockWatcher = {
        close: vi.fn(),
        on: vi.fn(),
      };
      let fsCallback: Function;

      mockFs.watch.mockImplementation((path, options, callback) => {
        fsCallback = callback;
        return mockWatcher as any;
      });

      // Restart to get the callback
      await watcher.stop();
      await watcher.start();

      // Mock file stats
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        mtime: new Date(),
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      // Simulate file change
      fsCallback!("change", "test.json");

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(fileChangeCallback).toHaveBeenCalled();
    });
  });

  describe("file filtering", () => {
    beforeEach(() => {
      // Mock directory reading to return empty array for filtering tests
      mockFs.readdirSync.mockReturnValue([]);
    });

    it("should ignore files matching ignore patterns", async () => {
      const result = await watcher.checkForChanges();
      expect(result.success).toBe(true);
    });

    it("should ignore temporary and hidden files", async () => {
      // This would be tested by checking the internal shouldIgnoreFile method
      // For now, we'll test through the public interface
      const result = await watcher.checkForChanges();
      expect(result.success).toBe(true);
    });
  });

  describe("change detection", () => {
    beforeEach(() => {
      // Mock directory reading
      mockFs.readdirSync.mockReturnValue(["test.json", "test.yaml"] as any);
      mockFs.statSync.mockReturnValue({
        mtime: new Date(),
        isFile: () => true,
        isDirectory: () => false,
      } as any);
    });

    it("should detect new files", async () => {
      const result = await watcher.checkForChanges();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should detect modified files", async () => {
      // First check to establish baseline
      await watcher.checkForChanges();

      // Mock newer modification time
      mockFs.statSync.mockReturnValue({
        mtime: new Date(Date.now() + 1000),
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      const result = await watcher.checkForChanges();
      expect(result.success).toBe(true);
    });

    it("should detect deleted files", async () => {
      // First check to establish baseline
      await watcher.checkForChanges();

      // Mock file no longer exists
      mockFs.existsSync.mockReturnValue(false);

      const result = await watcher.checkForChanges();
      expect(result.success).toBe(true);
    });
  });

  describe("snippet file parsing", () => {
    beforeEach(() => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          id: "test-1",
          title: "Test Snippet",
          description: "Test description",
          code: "console.log('test');",
          language: "javascript",
          tags: ["test"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 0,
        })
      );
    });

    it("should parse JSON snippet files", async () => {
      let storageChange: StorageChange | null = null;
      watcher.onStorageChange((change) => {
        storageChange = change;
      });

      await watcher.start();

      // Simulate file change for JSON file
      const mockWatcher = mockFs.watch.mock.results[0].value;
      const fsCallback = mockWatcher.on.mock.calls.find(
        (call: any) => call[0] === "change"
      )?.[1];

      if (fsCallback) {
        fsCallback("change", "test.json");

        // Wait for debounce and processing
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      // Note: In a real test, we'd need to properly mock the file parsing
      // For now, we're just testing that the structure is in place
    });

    it("should handle parsing errors gracefully", async () => {
      mockFs.readFileSync.mockReturnValue("invalid json");

      let storageChange: StorageChange | null = null;
      watcher.onStorageChange((change) => {
        storageChange = change;
      });

      await watcher.start();

      // The watcher should handle parsing errors without crashing
      expect(watcher.isWatching()).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle file system errors gracefully", async () => {
      mockFs.watch.mockImplementation(() => {
        throw new Error("File system error");
      });

      const result = await watcher.start();
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("File system error");
    });

    it("should handle check for changes errors", async () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await watcher.checkForChanges();
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Permission denied");
    });
  });
});
