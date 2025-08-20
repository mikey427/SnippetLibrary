import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Comprehensive test configuration for all test types
 * Used by CI/CD pipeline for complete test coverage
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",

    // Include all test files
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
    ],

    // Exclude specific patterns if needed
    exclude: ["node_modules/**", "dist/**", "out/**", "coverage/**"],

    // Setup files
    setupFiles: ["src/test-setup.ts"],

    // Timeouts for different test types
    testTimeout: 30000, // Default timeout
    hookTimeout: 10000,

    // Reporters
    reporter: process.env.CI ? ["json", "github-actions"] : ["verbose", "html"],

    // Output files
    outputFile: {
      json: "./test-reports/comprehensive-results.json",
      html: "./test-reports/comprehensive-results.html",
    },

    // Coverage configuration
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",

      // Coverage thresholds
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },

      // Include/exclude patterns
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/__tests__/**",
        "src/**/__mocks__/**",
        "src/test-setup.ts",
        "src/**/*.d.ts",
      ],

      // Exclude specific files from coverage
      excludeNodeModules: true,
    },

    // Pool configuration for parallel execution
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: process.env.CI ? 2 : undefined,
        minThreads: 1,
      },
    },

    // Retry configuration
    retry: process.env.CI ? 2 : 0,

    // Bail configuration
    bail: process.env.CI ? 5 : 0, // Stop after 5 failures in CI

    // Watch configuration
    watch: false, // Disabled for CI

    // Environment variables
    env: {
      NODE_ENV: "test",
      CI: process.env.CI || "false",
    },

    // Global test configuration
    globals: true,

    // Sequence configuration
    sequence: {
      shuffle: false, // Keep deterministic order
      concurrent: true,
    },

    // Logging
    logHeapUsage: process.env.CI === "true",

    // Performance monitoring
    benchmark: {
      include: ["src/**/*.bench.ts"],
      exclude: ["node_modules/**"],
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      // Mock VS Code API
      vscode: path.resolve(__dirname, "src/__mocks__/vscode.ts"),

      // Path aliases for easier imports
      "@core": path.resolve(__dirname, "src/core"),
      "@extension": path.resolve(__dirname, "src/extension"),
      "@webgui": path.resolve(__dirname, "src/webgui"),
      "@types": path.resolve(__dirname, "src/types"),
      "@interfaces": path.resolve(__dirname, "src/interfaces"),
    },
  },

  // Define different test configurations
  define: {
    __TEST_ENV__: JSON.stringify(process.env.NODE_ENV || "test"),
    __CI__: JSON.stringify(process.env.CI === "true"),
    __COVERAGE__: JSON.stringify(process.env.COVERAGE === "true"),
  },

  // Esbuild configuration for faster builds
  esbuild: {
    target: "node16",
    sourcemap: true,
  },
});
