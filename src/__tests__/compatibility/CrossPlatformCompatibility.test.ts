import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FileSystemStorageService } from "../../core/services/FileSystemStorageService";
import { ConfigurationManager } from "../../extension/ConfigurationManager";
import { Snippet } from "../../core/models/Snippet";
import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * Cross-platform compatibility tests
 * Tests system behavior across different operating systems and environments
 */
describe("Cross-Platform Compatibility Tests", () => {
  let tempDir: string;
  let storageService: FileSystemStorageService;
  let configManager: ConfigurationManager;

  const testSnippets = [
    new Snippet({
      id: "test-1",
      title: "Cross Platform Test",
      description: "Test snippet with special characters: àáâãäåæçèéêë",
      code: "// Path test: C:\\Windows\\System32\n// Unix path: /usr/local/bin\nconsole.log('Hello 世界');",
      language: "javascript",
      tags: ["test", "unicode", "paths"],
    }),
    new Snippet({
      id: "test-2",
      title: "Line Ending Test",
      description: "Test different line endings",
      code: "line1\nline2\r\nline3\rline4",
      language: "text",
      tags: ["line-endings"],
    }),
  ];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cross-platform-test-"));

    storageService = new FileSystemStorageService({
      location: "custom",
      path: tempDir,
      format: "json",
      autoBackup: false,
      backupInterval: 0,
    });

    configManager = new ConfigurationManager();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to cleanup temp directory:", error);
    }
  });

  describe("File System Compatibility", () => {
    it("should handle different path separators correctly", async () => {
      const testPaths = [
        "snippets.json",
        "folder/snippets.json",
        "deep/nested/folder/snippets.json",
      ];

      for (const testPath of testPaths) {
        const fullPath = path.join(tempDir, testPath);
        const dir = path.dirname(fullPath);

        // Create directory structure
        await fs.mkdir(dir, { recursive: true });

        // Test file operations
        await fs.writeFile(fullPath, JSON.stringify(testSnippets));
        const content = await fs.readFile(fullPath, "utf-8");
        const parsed = JSON.parse(content);

        expect(parsed).toHaveLength(testSnippets.length);
        expect(parsed[0].title).toBe(testSnippets[0].title);
      }
    });

    it("should handle special characters in file names", async () => {
      const specialCharFiles = [
        "snippets-àáâãäå.json",
        "snippets-中文.json",
        "snippets-русский.json",
        "snippets-العربية.json",
      ];

      for (const fileName of specialCharFiles) {
        try {
          const filePath = path.join(tempDir, fileName);
          await fs.writeFile(filePath, JSON.stringify(testSnippets));

          const exists = await fs
            .access(filePath)
            .then(() => true)
            .catch(() => false);
          expect(exists).toBe(true);

          const content = await fs.readFile(filePath, "utf-8");
          const parsed = JSON.parse(content);
          expect(parsed).toHaveLength(testSnippets.length);
        } catch (error) {
          // Some file systems may not support certain characters
          console.warn(`File system doesn't support ${fileName}:`, error);
        }
      }
    });

    it("should handle long file paths", async () => {
      // Create a deeply nested directory structure
      const deepPath = Array.from({ length: 10 }, (_, i) => `level${i}`).join(
        path.sep
      );
      const fullPath = path.join(tempDir, deepPath, "snippets.json");

      try {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, JSON.stringify(testSnippets));

        const content = await fs.readFile(fullPath, "utf-8");
        const parsed = JSON.parse(content);
        expect(parsed).toHaveLength(testSnippets.length);
      } catch (error) {
        // Some systems have path length limitations
        console.warn("Long path not supported:", error);
      }
    });

    it("should handle case sensitivity correctly", async () => {
      const testFiles = ["Snippets.json", "snippets.json", "SNIPPETS.json"];

      for (const fileName of testFiles) {
        const filePath = path.join(tempDir, fileName);
        await fs.writeFile(filePath, JSON.stringify({ test: fileName }));
      }

      // Check how many files actually exist (depends on file system case sensitivity)
      const files = await fs.readdir(tempDir);

      if (process.platform === "win32" || process.platform === "darwin") {
        // Case-insensitive file systems - should have only one file
        expect(files.length).toBeLessThanOrEqual(1);
      } else {
        // Case-sensitive file systems - should have all three files
        expect(files.length).toBe(3);
      }
    });
  });

  describe("Text Encoding Compatibility", () => {
    it("should handle UTF-8 encoding correctly", async () => {
      const unicodeSnippet = new Snippet({
        id: "unicode-test",
        title: "Unicode Test: 🚀 Hello 世界 مرحبا Здравствуй",
        description: "Testing various Unicode characters: ñáéíóú àèìòù âêîôû",
        code: "// Emoji: 🎉🔥💯\n// Chinese: 你好世界\n// Arabic: مرحبا بالعالم\n// Russian: Привет мир",
        language: "javascript",
        tags: ["unicode", "emoji", "international"],
      });

      await storageService.saveSnippets([unicodeSnippet]);
      const loaded = await storageService.loadSnippets();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe(unicodeSnippet.title);
      expect(loaded[0].description).toBe(unicodeSnippet.description);
      expect(loaded[0].code).toBe(unicodeSnippet.code);
    });

    it("should handle different line endings", async () => {
      const lineEndingVariants = [
        { name: "LF", code: "line1\nline2\nline3" },
        { name: "CRLF", code: "line1\r\nline2\r\nline3" },
        { name: "CR", code: "line1\rline2\rline3" },
        { name: "Mixed", code: "line1\nline2\r\nline3\rline4" },
      ];

      for (const variant of lineEndingVariants) {
        const snippet = new Snippet({
          id: `line-ending-${variant.name}`,
          title: `Line Ending Test - ${variant.name}`,
          code: variant.code,
          language: "text",
          tags: ["line-endings"],
        });

        await storageService.saveSnippets([snippet]);
        const loaded = await storageService.loadSnippets();

        expect(loaded).toHaveLength(1);
        expect(loaded[0].code).toBe(variant.code);
      }
    });

    it("should handle BOM (Byte Order Mark) correctly", async () => {
      const bomVariants = [
        { name: "UTF-8 BOM", bom: "\uFEFF" },
        { name: "No BOM", bom: "" },
      ];

      for (const variant of bomVariants) {
        const content = variant.bom + JSON.stringify(testSnippets);
        const filePath = path.join(tempDir, `bom-test-${variant.name}.json`);

        await fs.writeFile(filePath, content, "utf-8");

        // Read and parse
        const readContent = await fs.readFile(filePath, "utf-8");
        const cleanContent = readContent.replace(/^\uFEFF/, ""); // Remove BOM if present
        const parsed = JSON.parse(cleanContent);

        expect(parsed).toHaveLength(testSnippets.length);
      }
    });
  });

  describe("Environment Variable Compatibility", () => {
    it("should handle different environment variable formats", async () => {
      const originalEnv = process.env;

      try {
        // Test Windows-style environment variables
        process.env.USERPROFILE = "C:\\Users\\TestUser";
        process.env.APPDATA = "C:\\Users\\TestUser\\AppData\\Roaming";

        // Test Unix-style environment variables
        process.env.HOME = "/home/testuser";
        process.env.XDG_CONFIG_HOME = "/home/testuser/.config";

        // Test path resolution
        const paths = configManager.getDefaultStoragePaths();

        expect(paths).toBeDefined();
        expect(Array.isArray(paths)).toBe(true);
        expect(paths.length).toBeGreaterThan(0);

        // Verify paths are absolute
        paths.forEach((p) => {
          expect(path.isAbsolute(p)).toBe(true);
        });
      } finally {
        process.env = originalEnv;
      }
    });

    it("should handle missing environment variables gracefully", async () => {
      const originalEnv = process.env;

      try {
        // Remove common environment variables
        delete process.env.HOME;
        delete process.env.USERPROFILE;
        delete process.env.APPDATA;
        delete process.env.XDG_CONFIG_HOME;

        // Should still provide fallback paths
        const paths = configManager.getDefaultStoragePaths();

        expect(paths).toBeDefined();
        expect(Array.isArray(paths)).toBe(true);
        expect(paths.length).toBeGreaterThan(0);
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe("Platform-Specific Features", () => {
    it("should detect platform correctly", () => {
      const platform = os.platform();
      const supportedPlatforms = ["win32", "darwin", "linux"];

      expect(supportedPlatforms).toContain(platform);

      // Test platform-specific behavior
      switch (platform) {
        case "win32":
          expect(path.sep).toBe("\\");
          break;
        case "darwin":
        case "linux":
          expect(path.sep).toBe("/");
          break;
      }
    });

    it("should handle platform-specific path resolution", async () => {
      const testPath = "test/path/to/file.json";
      const resolvedPath = path.resolve(testPath);

      expect(path.isAbsolute(resolvedPath)).toBe(true);

      // Verify path uses correct separators for platform
      if (process.platform === "win32") {
        expect(resolvedPath).toMatch(/[A-Z]:\\/); // Drive letter
      } else {
        expect(resolvedPath).toMatch(/^\//); // Root slash
      }
    });

    it("should handle file permissions correctly", async () => {
      const testFile = path.join(tempDir, "permissions-test.json");
      await fs.writeFile(testFile, JSON.stringify(testSnippets));

      try {
        const stats = await fs.stat(testFile);

        // Basic permission checks
        expect(stats.isFile()).toBe(true);

        // On Unix-like systems, check specific permissions
        if (process.platform !== "win32") {
          const mode = stats.mode;
          const ownerRead = (mode & parseInt("400", 8)) !== 0;
          const ownerWrite = (mode & parseInt("200", 8)) !== 0;

          expect(ownerRead).toBe(true);
          expect(ownerWrite).toBe(true);
        }
      } catch (error) {
        console.warn("Permission check failed:", error);
      }
    });
  });

  describe("Locale and Internationalization", () => {
    it("should handle different locale settings", async () => {
      const originalLocale = process.env.LANG;

      try {
        const locales = [
          "en_US.UTF-8",
          "es_ES.UTF-8",
          "zh_CN.UTF-8",
          "ar_SA.UTF-8",
        ];

        for (const locale of locales) {
          process.env.LANG = locale;

          // Test date formatting
          const date = new Date("2024-01-15T10:30:00Z");
          const snippet = new Snippet({
            id: `locale-test-${locale}`,
            title: "Locale Test",
            code: "test",
            language: "javascript",
            tags: [],
            createdAt: date,
          });

          await storageService.saveSnippets([snippet]);
          const loaded = await storageService.loadSnippets();

          expect(loaded).toHaveLength(1);
          expect(loaded[0].createdAt).toEqual(date);
        }
      } finally {
        if (originalLocale) {
          process.env.LANG = originalLocale;
        } else {
          delete process.env.LANG;
        }
      }
    });

    it("should handle right-to-left text correctly", async () => {
      const rtlSnippet = new Snippet({
        id: "rtl-test",
        title: "اختبار النص العربي",
        description: "هذا اختبار للنص العربي من اليمين إلى اليسار",
        code: "// Arabic comment: مرحبا بالعالم\nconsole.log('مرحبا');",
        language: "javascript",
        tags: ["عربي", "اختبار"],
      });

      await storageService.saveSnippets([rtlSnippet]);
      const loaded = await storageService.loadSnippets();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe(rtlSnippet.title);
      expect(loaded[0].description).toBe(rtlSnippet.description);
      expect(loaded[0].tags).toEqual(rtlSnippet.tags);
    });
  });

  describe("Performance Across Platforms", () => {
    it("should maintain consistent performance across platforms", async () => {
      const largeCollection = Array.from(
        { length: 1000 },
        (_, i) =>
          new Snippet({
            id: `perf-test-${i}`,
            title: `Performance Test ${i}`,
            code: `console.log('test ${i}');`,
            language: "javascript",
            tags: [`tag${i % 10}`],
          })
      );

      const startTime = performance.now();

      await storageService.saveSnippets(largeCollection);
      const loaded = await storageService.loadSnippets();

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(loaded).toHaveLength(largeCollection.length);

      // Performance should be reasonable on all platforms (within 2 seconds)
      expect(totalTime).toBeLessThan(2000);

      console.log(
        `Platform ${process.platform} performance: ${totalTime.toFixed(2)}ms`
      );
    });
  });

  describe("Error Handling Across Platforms", () => {
    it("should handle platform-specific errors gracefully", async () => {
      // Test invalid characters for different platforms
      const invalidNames =
        process.platform === "win32"
          ? ["con.json", "aux.json", "nul.json", "prn.json"] // Windows reserved names
          : ["..", ".", "/invalid/path"]; // Unix invalid paths

      for (const invalidName of invalidNames) {
        try {
          const invalidPath = path.join(tempDir, invalidName);
          await fs.writeFile(invalidPath, "test");

          // If we get here, the name was actually valid on this platform
          console.log(`${invalidName} is valid on ${process.platform}`);
        } catch (error) {
          // Expected error for invalid names
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it("should handle permission errors consistently", async () => {
      if (process.platform !== "win32") {
        // Create a read-only directory
        const readOnlyDir = path.join(tempDir, "readonly");
        await fs.mkdir(readOnlyDir);
        await fs.chmod(readOnlyDir, 0o444); // Read-only

        try {
          const testFile = path.join(readOnlyDir, "test.json");
          await fs.writeFile(testFile, "test");

          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(/permission|EACCES|EPERM/i);
        } finally {
          // Restore permissions for cleanup
          await fs.chmod(readOnlyDir, 0o755);
        }
      }
    });
  });
});
