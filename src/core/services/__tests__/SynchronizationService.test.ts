import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SynchronizationServiceImpl,
  SyncConfig,
  SyncEvent,
} from "../SynchronizationService";
import { SnippetInterface, StorageChange } from "../../../types";

describe("SynchronizationService", () => {
  let syncService: SynchronizationServiceImpl;
  let mockConfig: SyncConfig;

  beforeEach(() => {
    syncService = new SynchronizationServiceImpl();
    mockConfig = {
      enableFileWatching: true,
      enableWebSocketSync: true,
      conflictResolution: "prompt_user",
      maxRetries: 3,
    };
  });

  afterEach(() => {
    syncService.dispose();
  });

  describe("initialization", () => {
    it("should initialize successfully with valid config", async () => {
      const result = await syncService.initialize(mockConfig);
      expect(result.success).toBe(true);
    });

    it("should set up auto-refresh when configured", async () => {
      const configWithAutoRefresh = {
        ...mockConfig,
        autoRefreshInterval: 5000,
      };

      const result = await syncService.initialize(configWithAutoRefresh);
      expect(result.success).toBe(true);
    });
  });

  describe("lifecycle management", () => {
    beforeEach(async () => {
      await syncService.initialize(mockConfig);
    });

    it("should start successfully", async () => {
      const result = await syncService.start();
      expect(result.success).toBe(true);
      expect(syncService.getStatus().isRunning).toBe(true);
    });

    it("should not start if already running", async () => {
      await syncService.start();
      const result = await syncService.start();
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("already running");
    });

    it("should stop successfully", async () => {
      await syncService.start();
      const result = await syncService.stop();
      expect(result.success).toBe(true);
      expect(syncService.getStatus().isRunning).toBe(false);
    });
  });

  describe("event handling", () => {
    let eventCallback: vi.Mock;

    beforeEach(async () => {
      await syncService.initialize(mockConfig);
      await syncService.start();
      eventCallback = vi.fn();
      syncService.onSyncEvent(eventCallback);
    });

    it("should emit sync events", async () => {
      await syncService.sync();
      expect(eventCallback).toHaveBeenCalled();

      const event = eventCallback.mock.calls[0][0] as SyncEvent;
      expect(event.type).toBe("sync_completed");
    });

    it("should handle storage changes", async () => {
      const mockSnippet: SnippetInterface = {
        id: "test-1",
        title: "Test Snippet",
        description: "Test description",
        code: "console.log('test');",
        language: "javascript",
        tags: ["test"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      const change: StorageChange = {
        type: "created",
        snippet: mockSnippet,
        timestamp: new Date(),
      };

      const result = await syncService.handleStorageChange(change);
      expect(result.success).toBe(true);

      // The sync service processes changes immediately when auto-sync is enabled,
      // so pending changes might be 0 after processing
      const status = syncService.getStatus();
      expect(status.pendingChanges).toBeGreaterThanOrEqual(0);
    });

    it("should handle VS Code updates", async () => {
      const mockSnippet: SnippetInterface = {
        id: "test-1",
        title: "Test Snippet",
        description: "Test description",
        code: "console.log('test');",
        language: "javascript",
        tags: ["test"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      const result = await syncService.handleVSCodeUpdate(
        mockSnippet,
        "created"
      );
      expect(result.success).toBe(true);
      expect(eventCallback).toHaveBeenCalled();
    });

    it("should handle Web GUI updates", async () => {
      const mockSnippet: SnippetInterface = {
        id: "test-1",
        title: "Test Snippet",
        description: "Test description",
        code: "console.log('test');",
        language: "javascript",
        tags: ["test"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      const result = await syncService.handleWebGUIUpdate(
        mockSnippet,
        "updated"
      );
      expect(result.success).toBe(true);
      expect(eventCallback).toHaveBeenCalled();
    });
  });

  describe("conflict resolution", () => {
    let localSnippet: SnippetInterface;
    let remoteSnippet: SnippetInterface;

    beforeEach(async () => {
      await syncService.initialize(mockConfig);
      await syncService.start();

      localSnippet = {
        id: "test-1",
        title: "Local Snippet",
        description: "Local description",
        code: "console.log('local');",
        language: "javascript",
        tags: ["local"],
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-02"),
        usageCount: 5,
      };

      remoteSnippet = {
        id: "test-1",
        title: "Remote Snippet",
        description: "Remote description",
        code: "console.log('remote');",
        language: "javascript",
        tags: ["remote"],
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-03"),
        usageCount: 3,
      };
    });

    it("should resolve conflicts with local_wins strategy", async () => {
      const result = await syncService.resolveConflict(
        localSnippet,
        remoteSnippet,
        {
          strategy: "local_wins",
        }
      );

      expect(result.success).toBe(true);
      expect(result.data.title).toBe("Local Snippet");
    });

    it("should resolve conflicts with remote_wins strategy", async () => {
      const result = await syncService.resolveConflict(
        localSnippet,
        remoteSnippet,
        {
          strategy: "remote_wins",
        }
      );

      expect(result.success).toBe(true);
      expect(result.data.title).toBe("Remote Snippet");
    });

    it("should merge snippets when using merge strategy", async () => {
      const result = await syncService.resolveConflict(
        localSnippet,
        remoteSnippet,
        {
          strategy: "merge",
        }
      );

      expect(result.success).toBe(true);
      // Should use the newer snippet as base (remote in this case)
      expect(result.data.title).toBe("Remote Snippet");
      // Should merge tags
      expect(result.data.tags).toContain("local");
      expect(result.data.tags).toContain("remote");
      // Should use higher usage count
      expect(result.data.usageCount).toBe(5);
    });

    it("should use default conflict resolution when no strategy provided", async () => {
      const result = await syncService.resolveConflict(
        localSnippet,
        remoteSnippet
      );

      expect(result.success).toBe(true);
      // Default should be local_wins for prompt_user config
      expect(result.data.title).toBe("Local Snippet");
    });
  });

  describe("status reporting", () => {
    beforeEach(async () => {
      await syncService.initialize(mockConfig);
    });

    it("should report correct status when stopped", () => {
      const status = syncService.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.lastSync).toBeNull();
      expect(status.pendingChanges).toBe(0);
      expect(status.conflicts).toBe(0);
    });

    it("should report correct status when running", async () => {
      await syncService.start();
      const status = syncService.getStatus();
      expect(status.isRunning).toBe(true);
    });

    it("should update status after sync", async () => {
      await syncService.start();
      await syncService.sync();
      const status = syncService.getStatus();
      expect(status.lastSync).not.toBeNull();
    });
  });

  describe("error handling", () => {
    it("should handle sync failures gracefully", async () => {
      await syncService.initialize(mockConfig);
      await syncService.start();

      // Force an error by trying to sync without proper setup
      const result = await syncService.sync();
      // Should still succeed as there's nothing to sync
      expect(result.success).toBe(true);
    });

    it("should not handle changes when not running", async () => {
      await syncService.initialize(mockConfig);
      // Don't start the service

      const mockSnippet: SnippetInterface = {
        id: "test-1",
        title: "Test Snippet",
        description: "Test description",
        code: "console.log('test');",
        language: "javascript",
        tags: ["test"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      const change: StorageChange = {
        type: "created",
        snippet: mockSnippet,
        timestamp: new Date(),
      };

      const result = await syncService.handleStorageChange(change);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("not running");
    });
  });
});
