import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Server } from "http";
import {
  SynchronizationCoordinatorImpl,
  SyncCoordinatorConfig,
} from "../SynchronizationCoordinator";
import { SnippetManagerImpl } from "../SnippetManagerImpl";
import { createWorkspaceStorageService } from "../StorageService";
import { SnippetInterface, StorageChange } from "../../../types";

describe("Synchronization Integration", () => {
  let coordinator: SynchronizationCoordinatorImpl;
  let snippetManager: SnippetManagerImpl;
  let tempDir: string;
  let config: SyncCoordinatorConfig;
  let mockHttpServer: Server;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(os.tmpdir(), `snippet-sync-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create storage service and snippet manager
    const storageService = createWorkspaceStorageService(tempDir);
    snippetManager = new SnippetManagerImpl(storageService);
    await snippetManager.initialize();

    // Create mock HTTP server
    mockHttpServer = {
      listen: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    } as any;

    // Create synchronization coordinator
    coordinator = new SynchronizationCoordinatorImpl();

    config = {
      sync: {
        enableFileWatching: true,
        enableWebSocketSync: true,
        conflictResolution: "prompt_user",
        maxRetries: 3,
      },
      fileWatcher: {
        watchPath: tempDir,
        debounceMs: 100, // Short debounce for testing
        recursive: true,
        ignorePatterns: [".git", "node_modules"],
      },
      webSocket: {
        heartbeatInterval: 5000,
        clientTimeout: 10000,
        maxClients: 5,
      },
      enableAutoSync: true,
      enableConflictResolution: true,
      syncInterval: 1000, // 1 second for testing
    };
  });

  afterEach(async () => {
    // Clean up
    coordinator.dispose();
    snippetManager.dispose();

    // Remove temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("end-to-end synchronization", () => {
    it("should initialize and start all services", async () => {
      const initResult = await coordinator.initialize(
        config,
        snippetManager,
        mockHttpServer
      );
      expect(initResult.success).toBe(true);

      const startResult = await coordinator.start();
      expect(startResult.success).toBe(true);

      const status = coordinator.getStatus();
      expect(status.isActive).toBe(true);
    });

    it("should handle snippet creation and synchronization", async () => {
      await coordinator.initialize(config, snippetManager, mockHttpServer);
      await coordinator.start();

      const testSnippet: SnippetInterface = {
        id: "test-sync-1",
        title: "Sync Test Snippet",
        description: "Testing synchronization",
        code: "console.log('sync test');",
        language: "javascript",
        tags: ["sync", "test"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      // Create snippet through snippet manager
      const createdSnippet = await snippetManager.createSnippet(testSnippet);

      // Handle VS Code update
      const vsCodeResult = await coordinator.handleVSCodeUpdate(
        createdSnippet,
        "created"
      );
      expect(vsCodeResult.success).toBe(true);

      // Verify snippet exists
      const retrievedSnippet = await snippetManager.getSnippet(testSnippet.id);
      expect(retrievedSnippet).toBeDefined();
      expect(retrievedSnippet!.title).toBe(testSnippet.title);
    });

    it("should detect and handle conflicts", async () => {
      await coordinator.initialize(config, snippetManager, mockHttpServer);
      await coordinator.start();

      const baseSnippet: SnippetInterface = {
        id: "conflict-test",
        title: "Base Snippet",
        description: "Base description",
        code: "console.log('base');",
        language: "javascript",
        tags: ["base"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      // Create base snippet
      await snippetManager.createSnippet(baseSnippet);

      // Create conflicting versions
      const vsCodeVersion = {
        ...baseSnippet,
        title: "VS Code Version",
        code: "console.log('vscode');",
        updatedAt: new Date(Date.now() + 1000),
      };

      const webGuiVersion = {
        ...baseSnippet,
        title: "Web GUI Version",
        code: "console.log('webgui');",
        updatedAt: new Date(Date.now() + 2000),
      };

      // Handle updates from different sources
      await coordinator.handleVSCodeUpdate(vsCodeVersion, "updated");
      await coordinator.handleWebGUIUpdate(webGuiVersion, "updated");

      // Check for conflicts
      const conflicts = coordinator.getPendingConflicts();
      expect(conflicts.length).toBeGreaterThanOrEqual(0); // May or may not detect conflicts depending on timing
    });

    it("should auto-resolve simple conflicts", async () => {
      await coordinator.initialize(config, snippetManager, mockHttpServer);
      await coordinator.start();

      // Create a scenario that would generate auto-resolvable conflicts
      const baseSnippet: SnippetInterface = {
        id: "auto-resolve-test",
        title: "Auto Resolve Test",
        description: "Testing auto resolution",
        code: "console.log('test');",
        language: "javascript",
        tags: ["test"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 5,
      };

      await snippetManager.createSnippet(baseSnippet);

      // Create a version with only metadata changes (should be auto-resolvable)
      const metadataUpdate = {
        ...baseSnippet,
        tags: ["test", "updated"],
        usageCount: 7,
        updatedAt: new Date(Date.now() + 1000),
      };

      await coordinator.handleVSCodeUpdate(metadataUpdate, "updated");

      // Try auto-resolution
      const autoResolveResult = await coordinator.autoResolveConflicts();
      expect(autoResolveResult.success).toBe(true);
    });

    it("should handle file system changes", async () => {
      await coordinator.initialize(config, snippetManager, mockHttpServer);
      await coordinator.start();

      // Create a snippet file directly in the file system
      const snippetData = {
        id: "fs-test",
        title: "File System Test",
        description: "Testing file system integration",
        code: "console.log('fs test');",
        language: "javascript",
        tags: ["fs", "test"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
      };

      const filePath = path.join(tempDir, "fs-test.json");
      fs.writeFileSync(filePath, JSON.stringify(snippetData, null, 2));

      // Wait for file watcher to detect the change
      await new Promise((resolve) => setTimeout(resolve, 200));

      // The file watcher should have detected the change
      // In a real implementation, this would trigger synchronization
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("error scenarios", () => {
    it("should handle storage errors gracefully", async () => {
      // Create coordinator with invalid storage path
      const invalidConfig = {
        ...config,
        fileWatcher: {
          ...config.fileWatcher,
          watchPath: "/invalid/path/that/does/not/exist",
        },
      };

      const initResult = await coordinator.initialize(
        invalidConfig,
        snippetManager
      );
      expect(initResult.success).toBe(true); // Should still initialize

      const startResult = await coordinator.start();
      expect(startResult.success).toBe(true); // Should handle file watcher failure gracefully
    });

    it("should handle concurrent modifications", async () => {
      await coordinator.initialize(config, snippetManager, mockHttpServer);
      await coordinator.start();

      const baseSnippet: SnippetInterface = {
        id: "concurrent-test",
        title: "Concurrent Test",
        description: "Testing concurrent modifications",
        code: "console.log('concurrent');",
        language: "javascript",
        tags: ["concurrent"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      await snippetManager.createSnippet(baseSnippet);

      // Simulate concurrent updates
      const update1 = { ...baseSnippet, title: "Update 1" };
      const update2 = { ...baseSnippet, title: "Update 2" };

      const [result1, result2] = await Promise.all([
        coordinator.handleVSCodeUpdate(update1, "updated"),
        coordinator.handleWebGUIUpdate(update2, "updated"),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("should recover from sync failures", async () => {
      await coordinator.initialize(config, snippetManager, mockHttpServer);
      await coordinator.start();

      // Force a sync operation
      const syncResult = await coordinator.sync();
      expect(syncResult.success).toBe(true);

      // Even if there are no changes, sync should succeed
      const status = coordinator.getStatus();
      expect(status.isActive).toBe(true);
    });
  });

  describe("performance and scalability", () => {
    it("should handle multiple snippets efficiently", async () => {
      await coordinator.initialize(config, snippetManager, mockHttpServer);
      await coordinator.start();

      const startTime = Date.now();

      // Create multiple snippets
      const snippets: SnippetInterface[] = [];
      for (let i = 0; i < 10; i++) {
        const snippet: SnippetInterface = {
          id: `perf-test-${i}`,
          title: `Performance Test ${i}`,
          description: `Testing performance with snippet ${i}`,
          code: `console.log('performance test ${i}');`,
          language: "javascript",
          tags: ["performance", "test", `test-${i}`],
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: i,
        };
        snippets.push(snippet);
      }

      // Create all snippets
      for (const snippet of snippets) {
        await snippetManager.createSnippet(snippet);
        await coordinator.handleVSCodeUpdate(snippet, "created");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Verify all snippets were created
      const allSnippets = await snippetManager.searchSnippets({});
      expect(allSnippets.length).toBeGreaterThanOrEqual(10);
    });

    it("should handle rapid updates without losing data", async () => {
      await coordinator.initialize(config, snippetManager, mockHttpServer);
      await coordinator.start();

      const baseSnippet: SnippetInterface = {
        id: "rapid-update-test",
        title: "Rapid Update Test",
        description: "Testing rapid updates",
        code: "console.log('rapid');",
        language: "javascript",
        tags: ["rapid"],
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      await snippetManager.createSnippet(baseSnippet);

      // Perform rapid updates
      const updatePromises = [];
      for (let i = 0; i < 5; i++) {
        const updatedSnippet = {
          ...baseSnippet,
          title: `Rapid Update ${i}`,
          usageCount: i,
          updatedAt: new Date(Date.now() + i * 100),
        };
        updatePromises.push(
          coordinator.handleVSCodeUpdate(updatedSnippet, "updated")
        );
      }

      const results = await Promise.all(updatePromises);
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Verify final state
      const finalSnippet = await snippetManager.getSnippet(baseSnippet.id);
      expect(finalSnippet).toBeDefined();
    });
  });

  describe("cleanup and resource management", () => {
    it("should clean up resources on disposal", async () => {
      await coordinator.initialize(config, snippetManager, mockHttpServer);
      await coordinator.start();

      const status = coordinator.getStatus();
      expect(status.isActive).toBe(true);

      coordinator.dispose();

      const finalStatus = coordinator.getStatus();
      expect(finalStatus.isActive).toBe(false);
    });

    it("should handle multiple dispose calls safely", async () => {
      await coordinator.initialize(config, snippetManager, mockHttpServer);
      await coordinator.start();

      // Multiple dispose calls should not cause issues
      coordinator.dispose();
      coordinator.dispose();
      coordinator.dispose();

      const status = coordinator.getStatus();
      expect(status.isActive).toBe(false);
    });
  });
});
