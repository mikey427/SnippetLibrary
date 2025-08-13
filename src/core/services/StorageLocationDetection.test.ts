import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileSystemStorageService } from "./FileSystemStorageService";
import {
  createWorkspaceStorageService,
  createGlobalStorageService,
} from "./index";

// Mock fs for controlled testing
vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      access: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    statSync: vi.fn(),
    watch: vi.fn(),
    constants: {
      W_OK: 2,
      R_OK: 4,
    },
  };
});

describe("Storage Location Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Workspace Storage Detection", () => {
    it("should detect workspace storage location correctly", () => {
      const workspacePath = "/workspace/project";
      const service = createWorkspaceStorageService(workspacePath);

      const locationResult = service.getStorageLocation();
      expect(locationResult.success).toBe(true);
      expect(locationResult.data!.type).toBe("workspace");
      expect(locationResult.data!.path).toContain("snippets.json");
    });

    it("should use default workspace path when none provided", () => {
      const service = createWorkspaceStorageService();

      const locationResult = service.getStorageLocation();
      expect(locationResult.success).toBe(true);
      expect(locationResult.data!.type).toBe("workspace");
      expect(locationResult.data!.path).toContain("snippets.json");
    });

    it("should create workspace directory structure", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      const service = createWorkspaceStorageService("/workspace/project");
      const result = await service.initialize();

      expect(result.success).toBe(true);
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(2); // Main dir and backup dir
    });
  });

  describe("Global Storage Detection", () => {
    it("should detect global storage location correctly", () => {
      const service = createGlobalStorageService();

      const locationResult = service.getStorageLocation();
      expect(locationResult.success).toBe(true);
      expect(locationResult.data!.type).toBe("global");
      expect(locationResult.data!.path).toContain("snippet-library");
    });

    it("should resolve global path relative to home directory", () => {
      const service = createGlobalStorageService();
      const config = service.getConfig();

      expect(config.location).toBe("global");

      const locationResult = service.getStorageLocation();
      expect(locationResult.success).toBe(true);
      // Path should be resolved to an absolute path
      expect(path.isAbsolute(locationResult.data!.path)).toBe(true);
    });

    it("should create global directory structure", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      const service = createGlobalStorageService();
      const result = await service.initialize();

      expect(result.success).toBe(true);
      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining("snippet-library"),
        { recursive: true }
      );
    });
  });

  describe("Storage Location Switching", () => {
    it("should switch from global to workspace storage", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);

      const service = createGlobalStorageService();

      // Verify initial location
      let locationResult = service.getStorageLocation();
      expect(locationResult.data!.type).toBe("global");

      // Switch to workspace
      const newLocation = {
        type: "workspace" as const,
        path: "/workspace/.vscode/snippets/snippets.json",
      };

      const switchResult = await service.setStorageLocation(newLocation);
      expect(switchResult.success).toBe(true);

      // Verify new location
      locationResult = service.getStorageLocation();
      expect(locationResult.data!.type).toBe("workspace");
      expect(locationResult.data!.path).toBe(newLocation.path);
    });

    it("should switch from workspace to global storage", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);

      const service = createWorkspaceStorageService();

      // Verify initial location
      let locationResult = service.getStorageLocation();
      expect(locationResult.data!.type).toBe("workspace");

      // Switch to global
      const homeDir = os.homedir();
      const newLocation = {
        type: "global" as const,
        path: path.join(
          homeDir,
          ".vscode/extensions/snippet-library/snippets.json"
        ),
      };

      const switchResult = await service.setStorageLocation(newLocation);
      expect(switchResult.success).toBe(true);

      // Verify new location
      locationResult = service.getStorageLocation();
      expect(locationResult.data!.type).toBe("global");
      expect(locationResult.data!.path).toBe(newLocation.path);
    });

    it("should handle invalid storage location switches", async () => {
      const service = createGlobalStorageService();

      const invalidLocation = {
        type: "invalid" as any,
        path: "/invalid/path",
      };

      const result = await service.setStorageLocation(invalidLocation);
      expect(result.success).toBe(false);
      expect(result.error.type).toBe("validation");
    });
  });

  describe("File Format Detection", () => {
    it("should handle JSON format correctly", () => {
      const service = new FileSystemStorageService({
        location: "global",
        format: "json",
      });

      const config = service.getConfig();
      expect(config.format).toBe("json");

      const locationResult = service.getStorageLocation();
      expect(locationResult.data!.path).toContain(".json");
    });

    it("should handle YAML format correctly", () => {
      const service = new FileSystemStorageService({
        location: "global",
        format: "yaml",
      });

      const config = service.getConfig();
      expect(config.format).toBe("yaml");

      const locationResult = service.getStorageLocation();
      expect(locationResult.data!.path).toContain(".yaml");
    });

    it("should switch between formats", async () => {
      const service = new FileSystemStorageService({
        location: "global",
        format: "json",
      });

      // Initial format
      expect(service.getConfig().format).toBe("json");

      // Switch to YAML
      const result = await service.updateConfig({ format: "yaml" });
      expect(result.success).toBe(true);
      expect(service.getConfig().format).toBe("yaml");
    });
  });

  describe("Path Resolution", () => {
    it("should resolve workspace paths relative to current directory", () => {
      const service = createWorkspaceStorageService();
      const locationResult = service.getStorageLocation();

      expect(locationResult.success).toBe(true);
      expect(path.isAbsolute(locationResult.data!.path)).toBe(true);
    });

    it("should resolve global paths relative to home directory", () => {
      const service = createGlobalStorageService();
      const locationResult = service.getStorageLocation();

      expect(locationResult.success).toBe(true);
      expect(path.isAbsolute(locationResult.data!.path)).toBe(true);
      expect(locationResult.data!.path).toContain(os.homedir());
    });

    it("should handle custom absolute paths", async () => {
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);

      const service = createGlobalStorageService();
      const customPath = path.join(
        os.tmpdir(),
        "custom-snippets",
        "snippets.json"
      );

      const result = await service.setStorageLocation({
        type: "global",
        path: customPath,
      });

      expect(result.success).toBe(true);

      const locationResult = service.getStorageLocation();
      expect(locationResult.data!.path).toBe(customPath);
    });
  });
});
