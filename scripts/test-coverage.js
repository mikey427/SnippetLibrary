#!/usr/bin/env node

/**
 * Test coverage analysis script
 * Generates comprehensive coverage reports for all test types
 */

const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");

class CoverageAnalyzer {
  constructor() {
    this.coverageDir = path.join(process.cwd(), "coverage");
    this.reportsDir = path.join(process.cwd(), "test-reports");
  }

  async run() {
    console.log("📊 Starting Coverage Analysis");
    console.log("=" * 50);

    try {
      await this.ensureDirectories();
      await this.runCoverageTests();
      await this.generateCoverageReport();
      await this.analyzeCoverage();
    } catch (error) {
      console.error("❌ Coverage analysis failed:", error);
      process.exit(1);
    }
  }

  async ensureDirectories() {
    await fs.mkdir(this.coverageDir, { recursive: true });
    await fs.mkdir(this.reportsDir, { recursive: true });
  }

  async runCoverageTests() {
    console.log("🧪 Running tests with coverage...");
    
    return new Promise((resolve, reject) => {
      const args = [
        "vitest",
        "run",
        "--coverage",
        "--coverage.reporter=text",
        "--coverage.reporter=json",
        "--coverage.reporter=html",
        "--coverage.reporter=lcov",
        "--coverage.reportsDirectory=" + this.coverageDir,
        "--coverage.thresholds.lines=80",
        "--coverage.thresholds.functions=80",
        "--coverage.thresholds.branches=75",
        "--coverage.thresholds.statements=80",
      ];

      const child = spawn("npx", args, {
        stdio: "inherit",
        shell: true,
      });

      child.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Coverage tests completed");
          resolve();
        } else {
          reject(new Error(`Coverage tests failed with exit code ${code}`));
        }
      });

      child.on("error", reject);
    });
  }

  async generateCoverageReport() {
    console.log("📋 Generating coverage report...");

    try {
      const coverageFile = path.join(this.coverageDir, "coverage-summary.json");
      const coverageData = JSON.parse(await fs.readFile(coverageFile, "utf-8"));

      const report = {
        timestamp: new Date().toISOString(),
        summary: coverageData.total,
        files: Object.entries(coverageData)
          .filter(([key]) => key !== "total")
          .map(([file, data]) => ({
            file: file.replace(process.cwd(), ""),
            ...data,
          }))
          .sort((a, b) => a.file.localeCompare(b.file)),
      };

      // Write detailed JSON report
      await fs.writeFile(
        path.join(this.reportsDir, "coverage-report.json"),
        JSON.stringify(report, null, 2)
      );

      // Generate HTML summary
      const htmlReport = this.generateHTMLCoverageReport(report);
      await fs.writeFile(
        path.join(this.reportsDir, "coverage-summary.html"),
        htmlReport
      );

      console.log("✅ Coverage report generated");
    } catch (error) {
      console.warn("⚠️ Could not generate coverage report:", error.message);
    }
  }

  async analyzeCoverage() {
    console.log("🔍 Analyzing coverage...");

    try {
      const reportFile = path.join(this.reportsDir, "coverage-report.json");
      const report = JSON.parse(await fs.readFile(reportFile, "utf-8"));

      const { summary } = report;
      
      console.log("\n📊 Coverage Summary:");
      console.log(`   Lines: ${summary.lines.pct}% (${summary.lines.covered}/${summary.lines.total})`);
      console.log(`   Functions: ${summary.functions.pct}% (${summary.functions.covered}/${summary.functions.total})`);
      console.log(`   Branches: ${summary.branches.pct}% (${summary.branches.covered}/${summary.branches.total})`);
      console.log(`   Statements: ${summary.statements.pct}% (${summary.statements.covered}/${summary.statements.total})`);

      // Find files with low coverage
      const lowCoverageFiles = report.files.filter(file => 
        file.lines.pct < 70 || file.functions.pct < 70
      );

      if (lowCoverageFiles.length > 0) {
        console.log("\n⚠️ Files with low coverage:");
        lowCoverageFiles.forEach(file => {
          console.log(`   ${file.file}: ${file.lines.pct}% lines, ${file.functions.pct}% functions`);
        });
      }

      // Find untested files
      const untestedFiles = report.files.filter(file => 
        file.lines.covered === 0
      );

      if (untestedFiles.length > 0) {
        console.log("\n❌ Untested files:");
        untestedFiles.forEach(file => {
          console.log(`   ${file.file}`);
        });
      }

      // Coverage thresholds check
      const thresholds = {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      };

      const failedThresholds = Object.entries(thresholds).filter(
        ([metric, threshold]) => summary[metric].pct < threshold
      );

      if (failedThresholds.length > 0) {
        console.log("\n❌ Coverage thresholds not met:");
        failedThresholds.forEach(([metric, threshold]) => {
          console.log(`   ${metric}: ${summary[metric].pct}% < ${threshold}%`);
        });
        process.exit(1);
      } else {
        console.log("\n🎉 All coverage thresholds met!");
      }

    } catch (error) {
      console.warn("⚠️ Could not analyze coverage:", error.message);
    }
  }

  generateHTMLCoverageReport(report) {
    const { summary } = report;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage Report - Snippet Library</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; }
        .high { color: #28a745; }
        .medium { color: #ffc107; }
        .low { color: #dc3545; }
        .files-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .files-table th, .files-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .files-table th { background: #f8f9fa; font-weight: bold; }
        .files-table tr:hover { background: #f8f9fa; }
        .progress-bar { width: 100px; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Coverage Report</h1>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>Lines</h3>
                <div class="value ${this.getCoverageClass(summary.lines.pct)}">${summary.lines.pct}%</div>
                <div>${summary.lines.covered}/${summary.lines.total}</div>
            </div>
            <div class="metric">
                <h3>Functions</h3>
                <div class="value ${this.getCoverageClass(summary.functions.pct)}">${summary.functions.pct}%</div>
                <div>${summary.functions.covered}/${summary.functions.total}</div>
            </div>
            <div class="metric">
                <h3>Branches</h3>
                <div class="value ${this.getCoverageClass(summary.branches.pct)}">${summary.branches.pct}%</div>
                <div>${summary.branches.covered}/${summary.branches.total}</div>
            </div>
            <div class="metric">
                <h3>Statements</h3>
                <div class="value ${this.getCoverageClass(summary.statements.pct)}">${summary.statements.pct}%</div>
                <div>${summary.statements.covered}/${summary.statements.total}</div>
            </div>
        </div>

        <h2>File Coverage</h2>
        <table class="files-table">
            <thead>
                <tr>
                    <th>File</th>
                    <th>Lines</th>
                    <th>Functions</th>
                    <th>Branches</th>
                    <th>Statements</th>
                </tr>
            </thead>
            <tbody>
                ${report.files.map(file => `
                    <tr>
                        <td>${file.file}</td>
                        <td>
                            <div class="progress-bar">
                                <div class="progress-fill ${this.getCoverageClass(file.lines.pct)}" 
                                     style="width: ${file.lines.pct}%"></div>
                            </div>
                            ${file.lines.pct}%
                        </td>
                        <td>
                            <div class="progress-bar">
                                <div class="progress-fill ${this.getCoverageClass(file.functions.pct)}" 
                                     style="width: ${file.functions.pct}%"></div>
                            </div>
                            ${file.functions.pct}%
                        </td>
                        <td>
                            <div class="progress-bar">
                                <div class="progress-fill ${this.getCoverageClass(file.branches.pct)}" 
                                     style="width: ${file.branches.pct}%"></div>
                            </div>
                            ${file.branches.pct}%
                        </td>
                        <td>
                            <div class="progress-bar">
                                <div class="progress-fill ${this.getCoverageClass(file.statements.pct)}" 
                                     style="width: ${file.statements.pct}%"></div>
                            </div>
                            ${file.statements.pct}%
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;
  }

  getCoverageClass(percentage) {
    if (percentage >= 80) return "high";
    if (percentage >= 60) return "medium";
    return "low";
  }
}

// Run if called directly
if (require.main === module) {
  const analyzer = new CoverageAnalyzer();
  analyzer.run().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = CoverageAnalyzer;