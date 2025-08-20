import { vi } from "vitest";
import { Snippet } from "../../core/models/Snippet";
import { SearchQuery } from "../../core/models/SearchQuery";
import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * Shared test utilities for comprehensive test suite
 * Provides common helpers, mocks, and test data generators
 */

export class TestUtils {
  /**
   * Create a temporary directory for test isolation
   */
  static async createTempDir(prefix = "snippet-test-"): Promise<string> {
    return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  }

  /**
   * Clean up temporary directory
   */
  static async cleanupTempDir(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to cleanup temp directory:", error);
    }
  }

  /**
   * Generate test snippets with various characteristics
   */
  static generateTestSnippets(count: number = 10): Snippet[] {
    const languages = [
      "javascript",
      "typescript",
      "python",
      "java",
      "go",
      "rust",
    ];
    const categories = [
      "utility",
      "component",
      "algorithm",
      "pattern",
      "config",
    ];
    const tags = ["async", "util", "helper", "core", "advanced", "basic"];

    return Array.from({ length: count }, (_, i) => {
      const language = languages[i % languages.length];
      const category = categories[i % categories.length];
      const snippetTags = this.getRandomItems(
        tags,
        Math.floor(Math.random() * 3) + 1
      );

      return new Snippet({
        id: `test-snippet-${i}`,
        title: `Test Snippet ${i}`,
        description: `A ${language} ${category} snippet for testing`,
        code: this.generateCodeForLanguage(language, i),
        language,
        tags: snippetTags,
        category,
        createdAt: new Date(
          Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
        ),
        updatedAt: new Date(),
        usageCount: Math.floor(Math.random() * 100),
      });
    });
  }

  /**
   * Generate realistic code snippets for different languages
   */
  static generateCodeForLanguage(language: string, index: number): string {
    const codeTemplates = {
      javascript: `
function testFunction${index}() {
  const data = fetchData(${index});
  return data.map(item => item.value);
}

module.exports = testFunction${index};`,

      typescript: `
interface TestData${index} {
  id: number;
  value: string;
}

function processData${index}(data: TestData${index}[]): string[] {
  return data.filter(item => item.id > ${index}).map(item => item.value);
}

export default processData${index};`,

      python: `
def process_data_${index}(data):
    """Process test data for snippet ${index}"""
    return [item['value'] for item in data if item['id'] > ${index}]

class TestProcessor${index}:
    def __init__(self):
        self.index = ${index}
    
    def process(self, items):
        return [item for item in items if item > self.index]`,

      java: `
public class TestProcessor${index} {
    private final int index = ${index};
    
    public List<String> processData(List<TestData> data) {
        return data.stream()
            .filter(d -> d.getId() > index)
            .map(TestData::getValue)
            .collect(Collectors.toList());
    }
}`,

      go: `
package main

import "fmt"

type TestData struct {
    ID    int
    Value string
}

func ProcessData${index}(data []TestData) []string {
    var result []string
    for _, item := range data {
        if item.ID > ${index} {
            result = append(result, item.Value)
        }
    }
    return result
}`,

      rust: `
#[derive(Debug)]
struct TestData {
    id: i32,
    value: String,
}

fn process_data_${index}(data: Vec<TestData>) -> Vec<String> {
    data.into_iter()
        .filter(|item| item.id > ${index})
        .map(|item| item.value)
        .collect()
}`,
    };

    return (
      codeTemplates[language as keyof typeof codeTemplates] ||
      `// ${language} test snippet ${index}\nconsole.log("Test ${index}");`
    );
  }

  /**
   * Get random items from an array
   */
  static getRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Create mock VS Code API
   */
  static createMockVSCodeAPI() {
    return {
      window: {
        showInformationMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInputBox: vi.fn(),
        showQuickPick: vi.fn(),
        showSaveDialog: vi.fn(),
        showOpenDialog: vi.fn(),
        withProgress: vi.fn(),
        activeTextEditor: undefined,
        onDidChangeWindowState: vi.fn(() => ({ dispose: vi.fn() })),
        state: { focused: true },
      },
      workspace: {
        getConfiguration: vi.fn(() => ({
          get: vi.fn((key: string, defaultValue?: any) => defaultValue),
          update: vi.fn(),
        })),
        workspaceFolders: [],
        fs: {
          writeFile: vi.fn(),
          readFile: vi.fn(),
        },
        onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
      },
      commands: {
        executeCommand: vi.fn(),
        registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
      },
      env: {
        openExternal: vi.fn(),
        clipboard: {
          writeText: vi.fn(),
        },
      },
      Uri: {
        parse: vi.fn((url: string) => ({ toString: () => url })),
      },
      ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3,
      },
      ProgressLocation: {
        Notification: 15,
      },
    };
  }

  /**
   * Create mock storage service
   */
  static createMockStorageService() {
    const snippets: Snippet[] = [];

    return {
      loadSnippets: vi.fn().mockResolvedValue(snippets),
      saveSnippets: vi.fn().mockImplementation((newSnippets: Snippet[]) => {
        snippets.splice(0, snippets.length, ...newSnippets);
        return Promise.resolve();
      }),
      watchChanges: vi.fn(),
      getStorageLocation: vi
        .fn()
        .mockReturnValue({ type: "global", path: "/mock/path" }),
      setStorageLocation: vi.fn().mockResolvedValue(undefined),
    };
  }

  /**
   * Create mock snippet manager
   */
  static createMockSnippetManager() {
    const snippets = new Map<string, Snippet>();

    return {
      createSnippet: vi.fn().mockImplementation(async (data: any) => {
        const snippet = new Snippet({ ...data, id: `mock-${Date.now()}` });
        snippets.set(snippet.id, snippet);
        return snippet;
      }),
      getSnippet: vi.fn().mockImplementation(async (id: string) => {
        return snippets.get(id) || null;
      }),
      updateSnippet: vi
        .fn()
        .mockImplementation(async (id: string, updates: any) => {
          const snippet = snippets.get(id);
          if (snippet) {
            Object.assign(snippet, updates);
            return snippet;
          }
          return null;
        }),
      deleteSnippet: vi.fn().mockImplementation(async (id: string) => {
        return snippets.delete(id);
      }),
      searchSnippets: vi.fn().mockImplementation(async (query: SearchQuery) => {
        return Array.from(snippets.values()).filter((snippet) => {
          if (
            query.text &&
            !snippet.title.toLowerCase().includes(query.text.toLowerCase())
          ) {
            return false;
          }
          if (query.language && snippet.language !== query.language) {
            return false;
          }
          if (query.tags && query.tags.length > 0) {
            return query.tags.some((tag) => snippet.tags.includes(tag));
          }
          return true;
        });
      }),
      getAllSnippets: vi.fn().mockImplementation(async () => {
        return Array.from(snippets.values());
      }),
      importSnippets: vi.fn(),
      exportSnippets: vi.fn(),
    };
  }

  /**
   * Wait for a condition to be true
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await this.sleep(interval);
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();

    return {
      result,
      duration: endTime - startTime,
    };
  }

  /**
   * Create test search queries
   */
  static createTestSearchQueries(): SearchQuery[] {
    return [
      new SearchQuery({ text: "function" }),
      new SearchQuery({ language: "javascript" }),
      new SearchQuery({ tags: ["util", "helper"] }),
      new SearchQuery({ text: "test", language: "typescript" }),
      new SearchQuery({
        text: "data",
        language: "python",
        tags: ["algorithm"],
        sortBy: "usageCount",
        sortOrder: "desc",
      }),
    ];
  }

  /**
   * Assert performance within threshold
   */
  static assertPerformance(
    duration: number,
    threshold: number,
    operation: string
  ): void {
    if (duration > threshold) {
      throw new Error(
        `Performance threshold exceeded for ${operation}: ${duration.toFixed(
          2
        )}ms > ${threshold}ms`
      );
    }
  }

  /**
   * Create mock fetch for API testing
   */
  static createMockFetch() {
    return vi.fn().mockImplementation((url: string, options?: any) => {
      // Default successful response
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      });
    });
  }

  /**
   * Create test file content
   */
  static createTestFileContent(snippets: Snippet[]): string {
    return JSON.stringify(snippets, null, 2);
  }

  /**
   * Validate snippet structure
   */
  static validateSnippet(snippet: any): snippet is Snippet {
    return (
      typeof snippet.id === "string" &&
      typeof snippet.title === "string" &&
      typeof snippet.code === "string" &&
      typeof snippet.language === "string" &&
      Array.isArray(snippet.tags) &&
      snippet.createdAt instanceof Date &&
      snippet.updatedAt instanceof Date
    );
  }

  /**
   * Create test environment variables
   */
  static createTestEnv(): Record<string, string> {
    return {
      NODE_ENV: "test",
      CI: "false",
      HOME: "/mock/home",
      USERPROFILE: "C:\\Users\\MockUser",
      APPDATA: "C:\\Users\\MockUser\\AppData\\Roaming",
      XDG_CONFIG_HOME: "/mock/home/.config",
    };
  }

  /**
   * Mock console methods for testing
   */
  static mockConsole() {
    return {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
  }

  /**
   * Create performance benchmark
   */
  static createBenchmark(name: string) {
    const startTime = performance.now();

    return {
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`Benchmark ${name}: ${duration.toFixed(2)}ms`);
        return duration;
      },
    };
  }
}
