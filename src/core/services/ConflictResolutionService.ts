import { EventEmitter } from "events";
import { SnippetInterface, Result, ErrorType } from "../../types";

/**
 * Conflict types
 */
export enum ConflictType {
  CONTENT_CONFLICT = "content_conflict",
  METADATA_CONFLICT = "metadata_conflict",
  TIMESTAMP_CONFLICT = "timestamp_conflict",
  DELETION_CONFLICT = "deletion_conflict",
}

/**
 * Conflict information
 */
export interface Conflict {
  id: string;
  type: ConflictType;
  snippetId: string;
  localSnippet: SnippetInterface;
  remoteSnippet: SnippetInterface;
  detectedAt: Date;
  source: "vscode" | "webgui" | "filesystem";
  severity: "low" | "medium" | "high";
  autoResolvable: boolean;
}

/**
 * Conflict resolution strategy
 */
export interface ResolutionStrategy {
  type:
    | "local_wins"
    | "remote_wins"
    | "merge"
    | "manual"
    | "newest_wins"
    | "most_used_wins";
  mergeFields?: string[]; // Fields to merge when using merge strategy
  customResolver?: (
    local: SnippetInterface,
    remote: SnippetInterface
  ) => SnippetInterface;
}

/**
 * Conflict resolution result
 */
export interface ResolutionResult {
  conflictId: string;
  resolvedSnippet: SnippetInterface;
  strategy: ResolutionStrategy;
  appliedAt: Date;
  changes: string[]; // Description of changes made
}

/**
 * Interface for conflict resolution service
 */
export interface ConflictResolutionService {
  /**
   * Detect conflicts between two snippets
   */
  detectConflict(
    localSnippet: SnippetInterface,
    remoteSnippet: SnippetInterface,
    source: "vscode" | "webgui" | "filesystem"
  ): Conflict | null;

  /**
   * Resolve a conflict using the specified strategy
   */
  resolveConflict(
    conflict: Conflict,
    strategy: ResolutionStrategy
  ): Promise<Result<ResolutionResult>>;

  /**
   * Auto-resolve conflicts that can be safely resolved
   */
  autoResolveConflicts(
    conflicts: Conflict[]
  ): Promise<Result<ResolutionResult[]>>;

  /**
   * Get all pending conflicts
   */
  getPendingConflicts(): Conflict[];

  /**
   * Get conflict by ID
   */
  getConflict(conflictId: string): Conflict | null;

  /**
   * Add a conflict to the pending list
   */
  addConflict(conflict: Conflict): void;

  /**
   * Remove a conflict from the pending list
   */
  removeConflict(conflictId: string): boolean;

  /**
   * Clear all conflicts
   */
  clearConflicts(): void;

  /**
   * Register conflict detection callback
   */
  onConflictDetected(callback: (conflict: Conflict) => void): void;

  /**
   * Register conflict resolution callback
   */
  onConflictResolved(callback: (result: ResolutionResult) => void): void;

  /**
   * Get conflict statistics
   */
  getStatistics(): {
    totalConflicts: number;
    resolvedConflicts: number;
    pendingConflicts: number;
    autoResolvedConflicts: number;
  };

  /**
   * Dispose resources
   */
  dispose(): void;
}

/**
 * Implementation of conflict resolution service
 */
export class ConflictResolutionServiceImpl
  extends EventEmitter
  implements ConflictResolutionService
{
  private pendingConflicts = new Map<string, Conflict>();
  private resolvedConflicts: ResolutionResult[] = [];
  private conflictCounter = 0;

  detectConflict(
    localSnippet: SnippetInterface,
    remoteSnippet: SnippetInterface,
    source: "vscode" | "webgui" | "filesystem"
  ): Conflict | null {
    // No conflict if snippets are identical
    if (this.areSnippetsIdentical(localSnippet, remoteSnippet)) {
      return null;
    }

    const conflictType = this.determineConflictType(
      localSnippet,
      remoteSnippet
    );
    const severity = this.determineSeverity(
      localSnippet,
      remoteSnippet,
      conflictType
    );
    const autoResolvable = this.isAutoResolvable(conflictType, severity);

    const conflict: Conflict = {
      id: `conflict_${++this.conflictCounter}_${Date.now()}`,
      type: conflictType,
      snippetId: localSnippet.id,
      localSnippet,
      remoteSnippet,
      detectedAt: new Date(),
      source,
      severity,
      autoResolvable,
    };

    return conflict;
  }

  async resolveConflict(
    conflict: Conflict,
    strategy: ResolutionStrategy
  ): Promise<Result<ResolutionResult>> {
    try {
      let resolvedSnippet: SnippetInterface;
      const changes: string[] = [];

      switch (strategy.type) {
        case "local_wins":
          resolvedSnippet = { ...conflict.localSnippet };
          changes.push("Used local version");
          break;

        case "remote_wins":
          resolvedSnippet = { ...conflict.remoteSnippet };
          changes.push("Used remote version");
          break;

        case "newest_wins":
          if (
            conflict.localSnippet.updatedAt >= conflict.remoteSnippet.updatedAt
          ) {
            resolvedSnippet = { ...conflict.localSnippet };
            changes.push("Used local version (newer)");
          } else {
            resolvedSnippet = { ...conflict.remoteSnippet };
            changes.push("Used remote version (newer)");
          }
          break;

        case "most_used_wins":
          if (
            conflict.localSnippet.usageCount >=
            conflict.remoteSnippet.usageCount
          ) {
            resolvedSnippet = { ...conflict.localSnippet };
            changes.push("Used local version (more used)");
          } else {
            resolvedSnippet = { ...conflict.remoteSnippet };
            changes.push("Used remote version (more used)");
          }
          break;

        case "merge":
          const mergeResult = this.mergeSnippets(
            conflict.localSnippet,
            conflict.remoteSnippet,
            strategy.mergeFields
          );
          resolvedSnippet = mergeResult.snippet;
          changes.push(...mergeResult.changes);
          break;

        case "manual":
          if (strategy.customResolver) {
            resolvedSnippet = strategy.customResolver(
              conflict.localSnippet,
              conflict.remoteSnippet
            );
            changes.push("Applied custom resolution");
          } else {
            return {
              success: false,
              error: {
                type: ErrorType.validation,
                message:
                  "Manual resolution requires a custom resolver function",
                recoverable: true,
                suggestedAction: "Provide a custom resolver function",
              },
            };
          }
          break;

        default:
          return {
            success: false,
            error: {
              type: ErrorType.validation,
              message: `Unknown resolution strategy: ${strategy.type}`,
              recoverable: true,
              suggestedAction: "Use a valid resolution strategy",
            },
          };
      }

      // Update timestamp
      resolvedSnippet.updatedAt = new Date();

      const result: ResolutionResult = {
        conflictId: conflict.id,
        resolvedSnippet,
        strategy,
        appliedAt: new Date(),
        changes,
      };

      // Remove from pending conflicts
      this.pendingConflicts.delete(conflict.id);
      this.resolvedConflicts.push(result);

      // Emit resolution event
      this.emit("conflictResolved", result);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: `Failed to resolve conflict: ${error}`,
          recoverable: true,
        },
      };
    }
  }

  async autoResolveConflicts(
    conflicts: Conflict[]
  ): Promise<Result<ResolutionResult[]>> {
    const results: ResolutionResult[] = [];
    const errors: string[] = [];

    for (const conflict of conflicts) {
      if (!conflict.autoResolvable) {
        continue;
      }

      let strategy: ResolutionStrategy;

      // Determine auto-resolution strategy based on conflict type
      switch (conflict.type) {
        case ConflictType.TIMESTAMP_CONFLICT:
          strategy = { type: "newest_wins" };
          break;

        case ConflictType.METADATA_CONFLICT:
          strategy = {
            type: "merge",
            mergeFields: ["tags", "category", "usageCount"],
          };
          break;

        case ConflictType.CONTENT_CONFLICT:
          if (conflict.severity === "low") {
            strategy = { type: "newest_wins" };
          } else {
            // Skip high-severity content conflicts
            continue;
          }
          break;

        default:
          strategy = { type: "local_wins" };
      }

      const result = await this.resolveConflict(conflict, strategy);
      if (result.success) {
        results.push(result.data);
      } else {
        errors.push(
          `Failed to resolve conflict ${conflict.id}: ${result.error.message}`
        );
      }
    }

    if (errors.length > 0 && results.length === 0) {
      return {
        success: false,
        error: {
          type: ErrorType.unknown,
          message: `Failed to auto-resolve conflicts: ${errors.join(", ")}`,
          recoverable: true,
        },
      };
    }

    return { success: true, data: results };
  }

  getPendingConflicts(): Conflict[] {
    return Array.from(this.pendingConflicts.values());
  }

  getConflict(conflictId: string): Conflict | null {
    return this.pendingConflicts.get(conflictId) || null;
  }

  addConflict(conflict: Conflict): void {
    this.pendingConflicts.set(conflict.id, conflict);
    this.emit("conflictDetected", conflict);
  }

  removeConflict(conflictId: string): boolean {
    return this.pendingConflicts.delete(conflictId);
  }

  clearConflicts(): void {
    this.pendingConflicts.clear();
  }

  onConflictDetected(callback: (conflict: Conflict) => void): void {
    this.on("conflictDetected", callback);
  }

  onConflictResolved(callback: (result: ResolutionResult) => void): void {
    this.on("conflictResolved", callback);
  }

  getStatistics() {
    const autoResolvedCount = this.resolvedConflicts.filter(
      (r) => r.strategy.type !== "manual"
    ).length;

    return {
      totalConflicts:
        this.pendingConflicts.size + this.resolvedConflicts.length,
      resolvedConflicts: this.resolvedConflicts.length,
      pendingConflicts: this.pendingConflicts.size,
      autoResolvedConflicts: autoResolvedCount,
    };
  }

  dispose(): void {
    this.clearConflicts();
    this.resolvedConflicts = [];
    this.removeAllListeners();
  }

  private areSnippetsIdentical(
    snippet1: SnippetInterface,
    snippet2: SnippetInterface
  ): boolean {
    return (
      snippet1.id === snippet2.id &&
      snippet1.title === snippet2.title &&
      snippet1.description === snippet2.description &&
      snippet1.code === snippet2.code &&
      snippet1.language === snippet2.language &&
      JSON.stringify(snippet1.tags.sort()) ===
        JSON.stringify(snippet2.tags.sort()) &&
      snippet1.category === snippet2.category &&
      snippet1.updatedAt.getTime() === snippet2.updatedAt.getTime()
    );
  }

  private determineConflictType(
    localSnippet: SnippetInterface,
    remoteSnippet: SnippetInterface
  ): ConflictType {
    // Check for deletion conflicts (one snippet is marked as deleted)
    // This would require additional metadata to track deletions

    // Check for content conflicts
    if (
      localSnippet.code !== remoteSnippet.code ||
      localSnippet.title !== remoteSnippet.title ||
      localSnippet.description !== remoteSnippet.description
    ) {
      return ConflictType.CONTENT_CONFLICT;
    }

    // Check for metadata conflicts
    if (
      JSON.stringify(localSnippet.tags.sort()) !==
        JSON.stringify(remoteSnippet.tags.sort()) ||
      localSnippet.category !== remoteSnippet.category ||
      localSnippet.language !== remoteSnippet.language ||
      localSnippet.usageCount !== remoteSnippet.usageCount
    ) {
      return ConflictType.METADATA_CONFLICT;
    }

    // Check for timestamp conflicts
    if (
      localSnippet.updatedAt.getTime() !== remoteSnippet.updatedAt.getTime()
    ) {
      return ConflictType.TIMESTAMP_CONFLICT;
    }

    return ConflictType.CONTENT_CONFLICT; // Default
  }

  private determineSeverity(
    localSnippet: SnippetInterface,
    remoteSnippet: SnippetInterface,
    conflictType: ConflictType
  ): "low" | "medium" | "high" {
    switch (conflictType) {
      case ConflictType.TIMESTAMP_CONFLICT:
        return "low";

      case ConflictType.METADATA_CONFLICT:
        // Check if only tags or category changed
        if (
          localSnippet.code === remoteSnippet.code &&
          localSnippet.title === remoteSnippet.title &&
          localSnippet.description === remoteSnippet.description
        ) {
          return "low";
        }
        return "medium";

      case ConflictType.CONTENT_CONFLICT:
        // Check similarity of content
        const similarity = this.calculateSimilarity(
          localSnippet.code,
          remoteSnippet.code
        );
        if (similarity > 0.8) {
          return "low";
        } else if (similarity > 0.5) {
          return "medium";
        } else {
          return "high";
        }

      case ConflictType.DELETION_CONFLICT:
        return "high";

      default:
        return "medium";
    }
  }

  private isAutoResolvable(
    conflictType: ConflictType,
    severity: "low" | "medium" | "high"
  ): boolean {
    switch (conflictType) {
      case ConflictType.TIMESTAMP_CONFLICT:
        return true;

      case ConflictType.METADATA_CONFLICT:
        return severity === "low" || severity === "medium";

      case ConflictType.CONTENT_CONFLICT:
        return severity === "low";

      case ConflictType.DELETION_CONFLICT:
        return false;

      default:
        return false;
    }
  }

  private mergeSnippets(
    localSnippet: SnippetInterface,
    remoteSnippet: SnippetInterface,
    mergeFields?: string[]
  ): { snippet: SnippetInterface; changes: string[] } {
    const changes: string[] = [];
    const merged = { ...localSnippet };

    // Use the newer snippet as the base
    const base =
      localSnippet.updatedAt >= remoteSnippet.updatedAt
        ? localSnippet
        : remoteSnippet;
    const other =
      localSnippet.updatedAt >= remoteSnippet.updatedAt
        ? remoteSnippet
        : localSnippet;

    if (base !== localSnippet) {
      Object.assign(merged, base);
      changes.push("Used remote version as base (newer)");
    }

    // Merge specific fields or use default merge logic
    const fieldsToMerge = mergeFields || ["tags", "usageCount"];

    for (const field of fieldsToMerge) {
      switch (field) {
        case "tags":
          // Union of tags from both snippets
          const allTags = Array.from(new Set([...base.tags, ...other.tags]));
          if (
            JSON.stringify(allTags.sort()) !== JSON.stringify(base.tags.sort())
          ) {
            merged.tags = allTags;
            changes.push("Merged tags from both versions");
          }
          break;

        case "usageCount":
          // Use the higher usage count
          const maxUsage = Math.max(base.usageCount, other.usageCount);
          if (maxUsage !== base.usageCount) {
            merged.usageCount = maxUsage;
            changes.push("Used higher usage count");
          }
          break;

        case "category":
          // Prefer non-empty category
          if (!base.category && other.category) {
            merged.category = other.category;
            changes.push("Used category from other version");
          }
          break;

        default:
          // For other fields, keep the base version
          break;
      }
    }

    return { snippet: merged, changes };
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation using Levenshtein distance
    const maxLength = Math.max(text1.length, text2.length);
    if (maxLength === 0) return 1;

    const distance = this.levenshteinDistance(text1, text2);
    return 1 - distance / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}
