#!/usr/bin/env node

/**
 * Automated test script for CI/CD pipeline
 * Runs comprehensive test suite with proper reporting and error handling
 */

const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");

class CITestRunner {
  constructor() {
    this.results = {
      unit: { passed: 0, failed: 0, skipped: 0, duration: 0 },
      integration: { passed: 0, failed: 0, skipped: 0, duration: 0 },
      e2e: { passed: 0, failed: 0, skipped: 0, duration: 0 },
      performance: { passed: 0, failed: 0, skipped: 0, duration: 0 },
      compatibility: { passed: 0, failed: 0, skipped: 0, duration: 0 },
    };
    this.totalStartTime = Date.now();
    this.reportDir = path.join(process.cwd(), "test-reports");
  }

  async run() {
    console.log("🚀 Starting CI Test Suite");
    console.log(`Platform: ${os.platform()} ${os.arch()}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Working Directory: ${process.cwd()}`);
    console.log("=" * 60);

    try {
      // Ensure report directory exists
      await this.ensureReportDirectory();

      // Run test suites in order
      await this.runUnitTests();
      await this.runIntegrationTests();
      await this.runE2ETests();
      await this.runPerformanceTests();
      await this.runCompatibilityTests();

      // Generate final report
      await this.generateFinalReport();

      // Exit with appropriate code
      const hasFailures = Object.values(this.results).some(result => result.failed > 0);
      process.exit(hasFailures ? 1 : 0);

    } catch (error) {
      console.error("❌ CI Test Suite failed:", error);
      process.exit(1);
    }
  }

  async ensureReportDirectory() {
    try {
      await fs.mkdir(this.reportDir, { recursive: true });
    } catch (error) {
      console.warn("Warning: Could not create report directory:", error.message);
    }
  }

  async runUnitTests() {
    console.log("\n📋 Running Unit Tests");
    console.log("-" * 40);

    const startTime = Date.now();
    
    try {
      const result = await this.runVitest({
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        exclude: [
          "src/**/__tests__/integration/**",
          "src/**/__tests__/e2e/**",
          "src/__tests__/performance/**",
          "src/__tests__/compatibility/**"
        ],
        reporter: "json",
        outputFile: path.join(this.reportDir, "unit-tests.json"),
      });

      this.results.unit = {
        ...result,
        duration: Date.now() - startTime,
      };

      console.log(`✅ Unit Tests: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
    } catch (error) {
      console.error("❌ Unit Tests failed:", error.message);
      this.results.unit.failed = 1;
      this.results.unit.duration = Date.now() - startTime;
    }
  }

  async runIntegrationTests() {
    console.log("\n🔗 Running Integration Tests");
    console.log("-" * 40);

    const startTime = Date.now();
    
    try {
      const result = await this.runVitest({
        include: ["src/**/__tests__/integration/**/*.test.ts"],
        reporter: "json",
        outputFile: path.join(this.reportDir, "integration-tests.json"),
        timeout: 30000, // Longer timeout for integration tests
      });

      this.results.integration = {
        ...result,
        duration: Date.now() - startTime,
      };

      console.log(`✅ Integration Tests: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
    } catch (error) {
      console.error("❌ Integration Tests failed:", error.message);
      this.results.integration.failed = 1;
      this.results.integration.duration = Date.now() - startTime;
    }
  }

  async runE2ETests() {
    console.log("\n🌐 Running End-to-End Tests");
    console.log("-" * 40);

    const startTime = Date.now();
    
    try {
      const result = await this.runVitest({
        include: ["src/**/__tests__/e2e/**/*.test.tsx"],
        reporter: "json",
        outputFile: path.join(this.reportDir, "e2e-tests.json"),
        timeout: 60000, // Longer timeout for E2E tests
        environment: "jsdom",
      });

      this.results.e2e = {
        ...result,
        duration: Date.now() - startTime,
      };

      console.log(`✅ E2E Tests: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
    } catch (error) {
      console.error("❌ E2E Tests failed:", error.message);
      this.results.e2e.failed = 1;
      this.results.e2e.duration = Date.now() - startTime;
    }
  }

  async runPerformanceTests() {
    console.log("\n⚡ Running Performance Tests");
    console.log("-" * 40);

    const startTime = Date.now();
    
    try {
      const result = await this.runVitest({
        include: ["src/__tests__/performance/**/*.test.ts"],
        reporter: "json",
        outputFile: path.join(this.reportDir, "performance-tests.json"),
        timeout: 120000, // Longer timeout for performance tests
      });

      this.results.performance = {
        ...result,
        duration: Date.now() - startTime,
      };

      console.log(`✅ Performance Tests: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
    } catch (error) {
      console.error("❌ Performance Tests failed:", error.message);
      this.results.performance.failed = 1;
      this.results.performance.duration = Date.now() - startTime;
    }
  }

  async runCompatibilityTests() {
    console.log("\n🔄 Running Cross-Platform Compatibility Tests");
    console.log("-" * 40);

    const startTime = Date.now();
    
    try {
      const result = await this.runVitest({
        include: ["src/__tests__/compatibility/**/*.test.ts"],
        reporter: "json",
        outputFile: path.join(this.reportDir, "compatibility-tests.json"),
        timeout: 60000,
      });

      this.results.compatibility = {
        ...result,
        duration: Date.now() - startTime,
      };

      console.log(`✅ Compatibility Tests: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
    } catch (error) {
      console.error("❌ Compatibility Tests failed:", error.message);
      this.results.compatibility.failed = 1;
      this.results.compatibility.duration = Date.now() - startTime;
    }
  }

  async runVitest(options) {
    return new Promise((resolve, reject) => {
      const args = ["run"];
      
      // Add include patterns
      if (options.include) {
        options.include.forEach(pattern => {
          args.push("--include", pattern);
        });
      }

      // Add exclude patterns
      if (options.exclude) {
        options.exclude.forEach(pattern => {
          args.push("--exclude", pattern);
        });
      }

      // Add reporter
      if (options.reporter) {
        args.push("--reporter", options.reporter);
      }

      // Add output file
      if (options.outputFile) {
        args.push("--outputFile", options.outputFile);
      }

      // Add timeout
      if (options.timeout) {
        args.push("--testTimeout", options.timeout.toString());
      }

      // Add environment
      if (options.environment) {
        args.push("--environment", options.environment);
      }

      // Add coverage if in CI
      if (process.env.CI) {
        args.push("--coverage");
      }

      const child = spawn("npx", ["vitest", ...args], {
        stdio: ["inherit", "pipe", "pipe"],
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      child.on("close", async (code) => {
        try {
          // Parse results from JSON output if available
          let result = { passed: 0, failed: 0, skipped: 0 };
          
          if (options.outputFile) {
            try {
              const reportContent = await fs.readFile(options.outputFile, "utf-8");
              const report = JSON.parse(reportContent);
              
              if (report.testResults) {
                result.passed = report.testResults.filter(t => t.status === "passed").length;
                result.failed = report.testResults.filter(t => t.status === "failed").length;
                result.skipped = report.testResults.filter(t => t.status === "skipped").length;
              }
            } catch (parseError) {
              console.warn("Could not parse test results:", parseError.message);
            }
          }

          if (code === 0) {
            resolve(result);
          } else {
            reject(new Error(`Tests failed with exit code ${code}`));
          }
        } catch (error) {
          reject(error);
        }
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  async generateFinalReport() {
    console.log("\n📊 Generating Final Report");
    console.log("=" * 60);

    const totalDuration = Date.now() - this.totalStartTime;
    const totalPassed = Object.values(this.results).reduce((sum, result) => sum + result.passed, 0);
    const totalFailed = Object.values(this.results).reduce((sum, result) => sum + result.failed, 0);
    const totalSkipped = Object.values(this.results).reduce((sum, result) => sum + result.skipped, 0);

    const report = {
      summary: {
        platform: `${os.platform()} ${os.arch()}`,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
        totalDuration: totalDuration,
        totalTests: totalPassed + totalFailed + totalSkipped,
        passed: totalPassed,
        failed: totalFailed,
        skipped: totalSkipped,
        success: totalFailed === 0,
      },
      suites: this.results,
    };

    // Write JSON report
    try {
      await fs.writeFile(
        path.join(this.reportDir, "final-report.json"),
        JSON.stringify(report, null, 2)
      );
    } catch (error) {
      console.warn("Could not write JSON report:", error.message);
    }

    // Write HTML report
    try {
      const htmlReport = this.generateHTMLReport(report);
      await fs.writeFile(
        path.join(this.reportDir, "final-report.html"),
        htmlReport
      );
    } catch (error) {
      console.warn("Could not write HTML report:", error.message);
    }

    // Console summary
    console.log(`\n📈 Test Summary:`);
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   ✅ Passed: ${totalPassed}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`   ⏱️  Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   🎯 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

    console.log(`\n📋 Suite Breakdown:`);
    Object.entries(this.results).forEach(([suite, result]) => {
      const status = result.failed > 0 ? "❌" : "✅";
      console.log(`   ${status} ${suite}: ${result.passed}/${result.passed + result.failed} (${(result.duration / 1000).toFixed(2)}s)`);
    });

    if (totalFailed > 0) {
      console.log(`\n❌ ${totalFailed} test(s) failed. Check the detailed reports in ${this.reportDir}`);
    } else {
      console.log(`\n🎉 All tests passed! Great job!`);
    }
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Snippet Library Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .suites { margin-top: 30px; }
        .suite { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 6px; }
        .suite h3 { margin: 0 0 10px 0; }
        .suite-stats { display: flex; gap: 20px; }
        .success { background-color: #d4edda; border-color: #c3e6cb; }
        .failure { background-color: #f8d7da; border-color: #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Snippet Library Test Report</h1>
            <p>Generated on ${new Date(report.summary.timestamp).toLocaleString()}</p>
            <p>Platform: ${report.summary.platform} | Node.js: ${report.summary.nodeVersion}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">${report.summary.totalTests}</div>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <div class="value passed">${report.summary.passed}</div>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <div class="value failed">${report.summary.failed}</div>
            </div>
            <div class="metric">
                <h3>Skipped</h3>
                <div class="value skipped">${report.summary.skipped}</div>
            </div>
            <div class="metric">
                <h3>Duration</h3>
                <div class="value">${(report.summary.totalDuration / 1000).toFixed(2)}s</div>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value ${report.summary.success ? 'passed' : 'failed'}">
                    ${((report.summary.passed / (report.summary.passed + report.summary.failed)) * 100).toFixed(1)}%
                </div>
            </div>
        </div>

        <div class="suites">
            <h2>Test Suites</h2>
            ${Object.entries(report.suites).map(([suite, result]) => `
                <div class="suite ${result.failed > 0 ? 'failure' : 'success'}">
                    <h3>${suite.charAt(0).toUpperCase() + suite.slice(1)} Tests</h3>
                    <div class="suite-stats">
                        <span class="passed">✅ ${result.passed} passed</span>
                        <span class="failed">❌ ${result.failed} failed</span>
                        <span class="skipped">⏭️ ${result.skipped} skipped</span>
                        <span>⏱️ ${(result.duration / 1000).toFixed(2)}s</span>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new CITestRunner();
  runner.run().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = CITestRunner;