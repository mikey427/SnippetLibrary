import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ConflictResolutionServiceImpl,
  ConflictType,
  Conflict,
  ResolutionStrategy,
} from "../ConflictResolutionService";
import { SnippetInterface } from "../../../types";

describe("ConflictResolutionService", () => {
  let conflictService: ConflictResolutionServiceImpl;
  let localSnippet: SnippetInterface;
  let remoteSnippet: SnippetInterface;

  beforeEach(() => {
    conflictService = new ConflictResolutionServiceImpl();

    localSnippet = {
      id: "test-1",
      title: "Local Snippet",
      description: "Local description",
      code: "console.log('local');",
      language: "javascript",
      tags: ["local", "test"],
      category: "utilities",
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
      tags: ["remote", "test"],
      category: "helpers",
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-03"),
      usageCount: 3,
    };
  });

  afterEach(() => {
    conflictService.dispose();
  });

  describe("conflict detection", () => {
    it("should detect no conflict for identical snippets", () => {
      const identicalSnippet = { ...localSnippet };
      const conflict = conflictService.detectConflict(
        localSnippet,
        identicalSnippet,
        "vscode"
      );
      expect(conflict).toBeNull();
    });

    it("should detect content conflicts", () => {
      const conflict = conflictService.detectConflict(
        localSnippet,
        remoteSnippet,
        "vscode"
      );
      expect(conflict).not.toBeNull();
      expect(conflict!.type).toBe(ConflictType.CONTENT_CONFLICT);
      expect(conflict!.snippetId).toBe("test-1");
      expect(conflict!.source).toBe("vscode");
    });

    it("should detect metadata conflicts", () => {
      const metadataConflict = {
        ...localSnippet,
        title: localSnippet.title, // Same title
        code: localSnippet.code, // Same code
        description: localSnippet.description, // Same description
        tags: ["different", "tags"], // Different tags
      };

      const conflict = conflictService.detectConflict(
        localSnippet,
        metadataConflict,
        "webgui"
      );
      expect(conflict).not.toBeNull();
      expect(conflict!.type).toBe(ConflictType.METADATA_CONFLICT);
    });

    it("should detect timestamp conflicts", () => {
      const timestampConflict = {
        ...localSnippet,
        updatedAt: new Date("2023-01-05"), // Different timestamp
      };

      const conflict = conflictService.detectConflict(
        localSnippet,
        timestampConflict,
        "filesystem"
      );
      expect(conflict).not.toBeNull();
      expect(conflict!.type).toBe(ConflictType.TIMESTAMP_CONFLICT);
    });

    it("should determine correct severity levels", () => {
      // High severity content conflict (very different code)
      const highSeverityRemote = {
        ...remoteSnippet,
        code: "completely different code that shares nothing with the original",
      };
      const highConflict = conflictService.detectConflict(
        localSnippet,
        highSeverityRemote,
        "vscode"
      );
      expect(highConflict!.severity).toBe("high");

      // Low severity metadata conflict
      const lowSeverityRemote = {
        ...localSnippet,
        tags: ["different", "tags"],
      };
      const lowConflict = conflictService.detectConflict(
        localSnippet,
        lowSeverityRemote,
        "vscode"
      );
      expect(lowConflict!.severity).toBe("low");
    });

    it("should determine auto-resolvability correctly", () => {
      // Timestamp conflicts should be auto-resolvable
      const timestampConflict = {
        ...localSnippet,
        updatedAt: new Date("2023-01-05"),
      };
      const conflict = conflictService.detectConflict(
        localSnippet,
        timestampConflict,
        "vscode"
      );
      expect(conflict!.autoResolvable).toBe(true);

      // High severity content conflicts should not be auto-resolvable
      const highSeverityRemote = {
        ...remoteSnippet,
        code: "completely different code",
      };
      const highConflict = conflictService.detectConflict(
        localSnippet,
        highSeverityRemote,
        "vscode"
      );
      expect(highConflict!.autoResolvable).toBe(false);
    });
  });

  describe("conflict resolution", () => {
    let conflict: Conflict;

    beforeEach(() => {
      conflict = conflictService.detectConflict(
        localSnippet,
        remoteSnippet,
        "vscode"
      )!;
    });

    it("should resolve with local_wins strategy", async () => {
      const strategy: ResolutionStrategy = { type: "local_wins" };
      const result = await conflictService.resolveConflict(conflict, strategy);

      expect(result.success).toBe(true);
      expect(result.data.resolvedSnippet.title).toBe("Local Snippet");
      expect(result.data.strategy).toBe(strategy);
      expect(result.data.changes).toContain("Used local version");
    });

    it("should resolve with remote_wins strategy", async () => {
      const strategy: ResolutionStrategy = { type: "remote_wins" };
      const result = await conflictService.resolveConflict(conflict, strategy);

      expect(result.success).toBe(true);
      expect(result.data.resolvedSnippet.title).toBe("Remote Snippet");
      expect(result.data.changes).toContain("Used remote version");
    });

    it("should resolve with newest_wins strategy", async () => {
      const strategy: ResolutionStrategy = { type: "newest_wins" };
      const result = await conflictService.resolveConflict(conflict, strategy);

      expect(result.success).toBe(true);
      // Remote is newer (2023-01-03 vs 2023-01-02)
      expect(result.data.resolvedSnippet.title).toBe("Remote Snippet");
      expect(result.data.changes).toContain("Used remote version (newer)");
    });

    it("should resolve with most_used_wins strategy", async () => {
      const strategy: ResolutionStrategy = { type: "most_used_wins" };
      const result = await conflictService.resolveConflict(conflict, strategy);

      expect(result.success).toBe(true);
      // Local has higher usage count (5 vs 3)
      expect(result.data.resolvedSnippet.title).toBe("Local Snippet");
      expect(result.data.changes).toContain("Used local version (more used)");
    });

    it("should resolve with merge strategy", async () => {
      const strategy: ResolutionStrategy = { type: "merge" };
      const result = await conflictService.resolveConflict(conflict, strategy);

      expect(result.success).toBe(true);

      const resolved = result.data.resolvedSnippet;
      // Should use remote as base (newer)
      expect(resolved.title).toBe("Remote Snippet");
      // Should merge tags
      expect(resolved.tags).toContain("local");
      expect(resolved.tags).toContain("remote");
      expect(resolved.tags).toContain("test");
      // Should use higher usage count
      expect(resolved.usageCount).toBe(5);
      // Should update timestamp
      expect(resolved.updatedAt.getTime()).toBeGreaterThan(
        remoteSnippet.updatedAt.getTime()
      );
    });

    it("should resolve with custom merge fields", async () => {
      const strategy: ResolutionStrategy = {
        type: "merge",
        mergeFields: ["category", "usageCount"],
      };
      const result = await conflictService.resolveConflict(conflict, strategy);

      expect(result.success).toBe(true);
      expect(result.data.resolvedSnippet.usageCount).toBe(5); // Higher value
    });

    it("should resolve with manual strategy and custom resolver", async () => {
      const customResolver = (
        local: SnippetInterface,
        remote: SnippetInterface
      ) => ({
        ...local,
        title: "Custom Resolved Title",
        description: remote.description,
      });

      const strategy: ResolutionStrategy = {
        type: "manual",
        customResolver,
      };
      const result = await conflictService.resolveConflict(conflict, strategy);

      expect(result.success).toBe(true);
      expect(result.data.resolvedSnippet.title).toBe("Custom Resolved Title");
      expect(result.data.resolvedSnippet.description).toBe(
        "Remote description"
      );
    });

    it("should fail manual resolution without custom resolver", async () => {
      const strategy: ResolutionStrategy = { type: "manual" };
      const result = await conflictService.resolveConflict(conflict, strategy);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("custom resolver function");
    });

    it("should fail with unknown strategy", async () => {
      const strategy = { type: "unknown_strategy" } as any;
      const result = await conflictService.resolveConflict(conflict, strategy);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Unknown resolution strategy");
    });

    it("should update resolved snippet timestamp", async () => {
      const strategy: ResolutionStrategy = { type: "local_wins" };
      const result = await conflictService.resolveConflict(conflict, strategy);

      expect(result.success).toBe(true);
      expect(result.data.resolvedSnippet.updatedAt.getTime()).toBeGreaterThan(
        localSnippet.updatedAt.getTime()
      );
    });
  });

  describe("auto-resolution", () => {
    it("should auto-resolve resolvable conflicts", async () => {
      const conflicts: Conflict[] = [
        {
          id: "conflict-1",
          type: ConflictType.TIMESTAMP_CONFLICT,
          snippetId: "test-1",
          localSnippet,
          remoteSnippet,
          detectedAt: new Date(),
          source: "vscode",
          severity: "low",
          autoResolvable: true,
        },
        {
          id: "conflict-2",
          type: ConflictType.METADATA_CONFLICT,
          snippetId: "test-2",
          localSnippet,
          remoteSnippet,
          detectedAt: new Date(),
          source: "webgui",
          severity: "low",
          autoResolvable: true,
        },
      ];

      const result = await conflictService.autoResolveConflicts(conflicts);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it("should skip non-resolvable conflicts", async () => {
      const conflicts: Conflict[] = [
        {
          id: "conflict-1",
          type: ConflictType.CONTENT_CONFLICT,
          snippetId: "test-1",
          localSnippet,
          remoteSnippet,
          detectedAt: new Date(),
          source: "vscode",
          severity: "high",
          autoResolvable: false,
        },
      ];

      const result = await conflictService.autoResolveConflicts(conflicts);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it("should use appropriate strategies for different conflict types", async () => {
      const timestampConflict: Conflict = {
        id: "timestamp-conflict",
        type: ConflictType.TIMESTAMP_CONFLICT,
        snippetId: "test-1",
        localSnippet,
        remoteSnippet,
        detectedAt: new Date(),
        source: "vscode",
        severity: "low",
        autoResolvable: true,
      };

      const result = await conflictService.autoResolveConflicts([
        timestampConflict,
      ]);
      expect(result.success).toBe(true);
      expect(result.data[0].strategy.type).toBe("newest_wins");
    });
  });

  describe("conflict management", () => {
    let conflict: Conflict;

    beforeEach(() => {
      conflict = {
        id: "test-conflict",
        type: ConflictType.CONTENT_CONFLICT,
        snippetId: "test-1",
        localSnippet,
        remoteSnippet,
        detectedAt: new Date(),
        source: "vscode",
        severity: "medium",
        autoResolvable: false,
      };
    });

    it("should add and retrieve conflicts", () => {
      conflictService.addConflict(conflict);

      const retrieved = conflictService.getConflict("test-conflict");
      expect(retrieved).toEqual(conflict);

      const pending = conflictService.getPendingConflicts();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toEqual(conflict);
    });

    it("should remove conflicts", () => {
      conflictService.addConflict(conflict);

      const removed = conflictService.removeConflict("test-conflict");
      expect(removed).toBe(true);

      const retrieved = conflictService.getConflict("test-conflict");
      expect(retrieved).toBeNull();
    });

    it("should return false when removing non-existent conflict", () => {
      const removed = conflictService.removeConflict("non-existent");
      expect(removed).toBe(false);
    });

    it("should clear all conflicts", () => {
      conflictService.addConflict(conflict);
      conflictService.addConflict({ ...conflict, id: "conflict-2" });

      conflictService.clearConflicts();

      const pending = conflictService.getPendingConflicts();
      expect(pending).toHaveLength(0);
    });
  });

  describe("event handling", () => {
    it("should emit conflict detected events", () => {
      const callback = vi.fn();
      conflictService.onConflictDetected(callback);

      const conflict: Conflict = {
        id: "test-conflict",
        type: ConflictType.CONTENT_CONFLICT,
        snippetId: "test-1",
        localSnippet,
        remoteSnippet,
        detectedAt: new Date(),
        source: "vscode",
        severity: "medium",
        autoResolvable: false,
      };

      conflictService.addConflict(conflict);
      expect(callback).toHaveBeenCalledWith(conflict);
    });

    it("should emit conflict resolved events", async () => {
      const callback = vi.fn();
      conflictService.onConflictResolved(callback);

      const conflict = conflictService.detectConflict(
        localSnippet,
        remoteSnippet,
        "vscode"
      )!;
      const strategy: ResolutionStrategy = { type: "local_wins" };

      await conflictService.resolveConflict(conflict, strategy);
      expect(callback).toHaveBeenCalled();
    });
  });

  describe("statistics", () => {
    it("should provide accurate statistics", async () => {
      const conflict1 = conflictService.detectConflict(
        localSnippet,
        remoteSnippet,
        "vscode"
      )!;
      const conflict2 = { ...conflict1, id: "conflict-2" };

      conflictService.addConflict(conflict1);
      conflictService.addConflict(conflict2);

      // Resolve one conflict
      await conflictService.resolveConflict(conflict1, { type: "local_wins" });

      const stats = conflictService.getStatistics();
      expect(stats.totalConflicts).toBe(2);
      expect(stats.resolvedConflicts).toBe(1);
      expect(stats.pendingConflicts).toBe(1);
      expect(stats.autoResolvedConflicts).toBe(1); // local_wins is considered auto-resolved
    });

    it("should track auto-resolved vs manual conflicts", async () => {
      const conflict = conflictService.detectConflict(
        localSnippet,
        remoteSnippet,
        "vscode"
      )!;

      // Resolve with manual strategy
      await conflictService.resolveConflict(conflict, {
        type: "manual",
        customResolver: (local) => local,
      });

      const stats = conflictService.getStatistics();
      expect(stats.autoResolvedConflicts).toBe(0);
    });
  });

  describe("similarity calculation", () => {
    it("should calculate text similarity correctly", () => {
      // This tests the private method indirectly through conflict detection
      const similarSnippet = {
        ...localSnippet,
        code: "console.log('local modified');", // Similar to original
      };

      const verySimilarConflict = conflictService.detectConflict(
        localSnippet,
        similarSnippet,
        "vscode"
      );
      // The similarity calculation may result in medium severity for this change
      expect(["low", "medium"]).toContain(verySimilarConflict!.severity);

      const veryDifferentSnippet = {
        ...localSnippet,
        code: "function completely() { return 'different'; }",
      };

      const veryDifferentConflict = conflictService.detectConflict(
        localSnippet,
        veryDifferentSnippet,
        "vscode"
      );
      expect(veryDifferentConflict!.severity).toBe("high");
    });
  });
});
