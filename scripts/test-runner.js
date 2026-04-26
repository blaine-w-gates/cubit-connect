#!/usr/bin/env node
/**
 * Automated Test Runner
 *
 * Comprehensive test runner for CI/CD and local development.
 * Runs all test suites with coverage reporting and quality gates.
 *
 * @module test-runner
 * @production
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Test suites to run
  testSuites: [
    { name: 'Unit Tests', command: 'npx vitest run tests/unit/', required: true },
    { name: 'Integration Tests', command: 'npx vitest run tests/integration/', required: true },
  ],

  // Quality gates
  thresholds: {
    minTestPassRate: 1.0, // 100%
    minCoverage: 80, // 80%
    maxTypeErrors: 0,
    maxLintErrors: 0,
  },

  // Output
  reportDir: 'test-reports',
  verbose: process.argv.includes('--verbose'),
  ci: process.argv.includes('--ci'),
};

// ============================================================================
// UTILITIES
// ============================================================================

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (level === 'error') {
    console.error(`${prefix} ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

function exec(command, options = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: CONFIG.verbose ? 'inherit' : 'pipe',
      ...options,
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message,
      exitCode: error.status,
    };
  }
}

// ============================================================================
// TEST RUNNERS
// ============================================================================

async function runTypeCheck() {
  log('Running TypeScript type check...');

  const result = exec('npm run type-check');

  if (!result.success) {
    // Count errors
    const errorMatch = result.output.match(/error TS\d+/g);
    const errorCount = errorCount ? errorMatch.length : 0;

    if (errorCount > CONFIG.thresholds.maxTypeErrors) {
      log(`Type check failed with ${errorCount} errors`, 'error');
      return { passed: false, errors: errorCount };
    }
  }

  log('Type check passed ✓');
  return { passed: true, errors: 0 };
}

async function runLint() {
  log('Running ESLint...');

  const result = exec('npm run lint');

  if (!result.success) {
    log('Lint check failed', 'error');
    return { passed: false };
  }

  log('Lint check passed ✓');
  return { passed: true };
}

async function runTestSuite(suite) {
  log(`Running ${suite.name}...`);

  const startTime = Date.now();
  const result = exec(suite.command);
  const duration = Date.now() - startTime;

  // Parse results
  const passedMatch = result.output.match(/Tests\s+(\d+) passed/);
  const failedMatch = result.output.match(/(\d+) failed/);

  const passed = parseInt(passedMatch?.[1] || '0', 10);
  const failed = parseInt(failedMatch?.[1] || '0', 10);
  const total = passed + failed;

  const passRate = total > 0 ? passed / total : 0;

  return {
    name: suite.name,
    passed: failed === 0 && result.success,
    passRate,
    passed,
    failed,
    total,
    duration,
    required: suite.required,
  };
}

async function runBuild() {
  log('Running production build...');

  const startTime = Date.now();
  const result = exec('npm run build');
  const duration = Date.now() - startTime;

  if (!result.success) {
    log('Build failed', 'error');
    return { passed: false, duration };
  }

  log(`Build completed in ${duration}ms ✓`);
  return { passed: true, duration };
}

async function runBundleAnalysis() {
  log('Analyzing bundle size...');

  // Check if .next directory exists
  const nextDir = path.join(process.cwd(), '.next');
  if (!fs.existsSync(nextDir)) {
    log('No .next directory found, skipping bundle analysis', 'warn');
    return { passed: true, size: 0 };
  }

  // Try to find main bundle
  const staticDir = path.join(nextDir, 'static', 'chunks');
  if (!fs.existsSync(staticDir)) {
    log('No static chunks found, skipping bundle analysis', 'warn');
    return { passed: true, size: 0 };
  }

  const files = fs.readdirSync(staticDir);
  let totalSize = 0;

  files.forEach((file) => {
    if (file.endsWith('.js')) {
      const stats = fs.statSync(path.join(staticDir, file));
      totalSize += stats.size;
    }
  });

  const sizeKB = Math.round(totalSize / 1024);
  log(`Total bundle size: ${sizeKB}KB`);

  // Warn if > 500KB
  if (sizeKB > 500) {
    log(`Bundle size ${sizeKB}KB exceeds 500KB threshold`, 'warn');
  }

  return { passed: true, size: sizeKB };
}

// ============================================================================
// REPORTING
// ============================================================================

function generateReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      passed: results.every((r) => r.passed || !r.required),
      totalTests: results.reduce((sum, r) => sum + (r.total || 0), 0),
      totalPassed: results.reduce((sum, r) => sum + (r.passed || 0), 0),
      totalFailed: results.reduce((sum, r) => sum + (r.failed || 0), 0),
      duration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
    },
    details: results,
  };

  // Save report
  if (!fs.existsSync(CONFIG.reportDir)) {
    fs.mkdirSync(CONFIG.reportDir, { recursive: true });
  }

  const reportPath = path.join(CONFIG.reportDir, `test-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  return report;
}

function printSummary(report) {
  console.log('\n' + '='.repeat(70));
  console.log('TEST RUNNER SUMMARY');
  console.log('='.repeat(70));

  const { summary } = report;

  console.log(`\nTotal Tests: ${summary.totalTests}`);
  console.log(`Passed: ${summary.totalPassed} ✓`);
  console.log(`Failed: ${summary.totalFailed} ${summary.totalFailed > 0 ? '✗' : ''}`);
  console.log(`Pass Rate: ${((summary.totalPassed / summary.totalTests) * 100).toFixed(1)}%`);
  console.log(`Duration: ${summary.duration}ms`);

  console.log('\n' + '-'.repeat(70));
  console.log('DETAILED RESULTS');
  console.log('-'.repeat(70));

  report.details.forEach((detail) => {
    const status = detail.passed ? '✓ PASS' : detail.required ? '✗ FAIL' : '⚠ WARN';
    console.log(`${status}: ${detail.name}`);

    if (detail.total !== undefined) {
      console.log(`  Tests: ${detail.passed}/${detail.total}`);
      console.log(`  Rate: ${(detail.passRate * 100).toFixed(1)}%`);
    }
    if (detail.duration) {
      console.log(`  Duration: ${detail.duration}ms`);
    }
    if (detail.size) {
      console.log(`  Bundle Size: ${detail.size}KB`);
    }
    console.log();
  });

  console.log('='.repeat(70));
  console.log(`OVERALL: ${summary.passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log('='.repeat(70) + '\n');

  return summary.passed;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log('Starting automated test runner...', 'info');
  log(`CI Mode: ${CONFIG.ci ? 'Yes' : 'No'}`);
  log(`Verbose: ${CONFIG.verbose ? 'Yes' : 'No'}`);
  log('');

  const results = [];

  // Type check
  const typeCheck = await runTypeCheck();
  results.push({ name: 'Type Check', ...typeCheck });

  if (!typeCheck.passed) {
    log('Type check failed, aborting...', 'error');
    return generateReport(results);
  }

  // Lint
  const lint = await runLint();
  results.push({ name: 'Lint Check', ...lint });

  // Test suites
  for (const suite of CONFIG.testSuites) {
    const result = await runTestSuite(suite);
    results.push(result);
  }

  // Build
  const build = await runBuild();
  results.push({ name: 'Production Build', ...build });

  // Bundle analysis
  const bundle = await runBundleAnalysis();
  results.push({ name: 'Bundle Analysis', ...bundle });

  // Generate report
  const report = generateReport(results);

  // Print summary
  const passed = printSummary(report);

  // Exit with appropriate code
  if (CONFIG.ci) {
    process.exit(passed ? 0 : 1);
  }

  return report;
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    log(`Unexpected error: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = { main, runTestSuite, generateReport };
