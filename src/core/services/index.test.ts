import { describe, it, expect } from "vitest";
import {
  createStorageService,
  createWorkspaceStorageService,
  createGlobalStorageService,
} from "./index";
import { FileSystemStorageService } from "./FileSystemStorageService";

describe("Storage Service Factory", () => {
  describe("createStorageService", () => {
    it("should create a FileSystemStorageService with default config", () => {
      const service = createStorageService();

      expect(service).toBeInstanceOf(FileSystemStorageService);
      expect(service.getConfig().location).toBe("global");
      expect(service.getConfig().format).toBe("json");
    });

    it("should create a FileSystemStorageService with custom config", () => {
      const service = createStorageService({
        location: "workspace",
        format: "yaml",
        autoBackup: false,
      });

      expect(service).toBeInstanceOf(FileSystemStorageService);
      expect(service.getConfig().location).toBe("workspace");
      expect(service.getConfig().format).toBe("yaml");
      expect(service.getConfig().autoBackup).toBe(false);
    });
  });

  describe("createWorkspaceStorageService", () => {
    it("should create a workspace storage service", () => {
      const service = createWorkspaceStorageService();

      expect(service).toBeInstanceOf(FileSystemStorageService);
      expect(service.getConfig().location).toBe("workspace");
      expect(service.getConfig().format).toBe("json");
      expect(service.getConfig().autoBackup).toBe(true);
    });

    it("should create a workspace storage service with custom path", () => {
      const customPath = "/custom/workspace/path";
      const service = createWorkspaceStorageService(customPath);

      expect(service).toBeInstanceOf(FileSystemStorageService);
      expect(service.getConfig().location).toBe("workspace");
      expect(service.getConfig().path).toContain("custom");
      expect(service.getConfig().path).toContain("workspace");
      expect(service.getConfig().path).toContain("path");
      expect(service.getConfig().path).toContain("snippets.json");
    });
  });

  describe("createGlobalStorageService", () => {
    it("should create a global storage service", () => {
      const service = createGlobalStorageService();

      expect(service).toBeInstanceOf(FileSystemStorageService);
      expect(service.getConfig().location).toBe("global");
      expect(service.getConfig().format).toBe("json");
      expect(service.getConfig().autoBackup).toBe(true);
    });
  });
});
