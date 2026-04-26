#!/usr/bin/env node
/**
 * Pre-Flight Check Script
 *
 * Run before deployment to verify all systems are ready.
 * Checks environment, dependencies, and configuration.
 *
 * @module preflight-check
 * @production
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CHECKS = {
  // Required environment variables
  requiredEnvVars: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ],

  // Optional but recommended
  recommendedEnvVars: [
    'NEXT_PUBLIC_SENTRY_DSN',
    'SLACK_WEBHOOK_URL',
    'NEXT_PUBLIC_APP_VERSION',
  ],

  // Required files
  requiredFiles: [
    'package.json',
    'next.config.ts',
    'tsconfig.json',
    'src/lib/supabaseClient.ts',
    'src/lib/supabaseSyncProd.ts',
  ],

  // Supabase migrations
  migrationsDir: 'supabase/migrations',

  // Bundle size limit (KB)
  maxBundleSizeKB: 500,
};

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

function checkEnvVars() {
  console.log('🔍 Checking environment variables...');

  const missing = [];
  const present = [];

  for (const envVar of CHECKS.requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    } else {
      present.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables:`);
    missing.forEach((v) => console.error(`   - ${v}`));
    return { passed: false, missing, present };
  }

  console.log(`✅ All required environment variables present (${present.length})`);

  // Check recommended
  const missingRecommended = [];
  for (const envVar of CHECKS.recommendedEnvVars) {
    if (!process.env[envVar]) {
      missingRecommended.push(envVar);
    }
  }

  if (missingRecommended.length > 0) {
    console.warn(`⚠️  Missing recommended environment variables:`);
    missingRecommended.forEach((v) => console.warn(`   - ${v}`));
  }

  return { passed: true, missing: [], present };
}

function checkRequiredFiles() {
  console.log('🔍 Checking required files...');

  const missing = [];
  const present = [];

  for (const file of CHECKS.requiredFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      missing.push(file);
    } else {
      present.push(file);
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Missing required files:`);
    missing.forEach((f) => console.error(`   - ${f}`));
    return { passed: false, missing, present };
  }

  console.log(`✅ All required files present (${present.length})`);
  return { passed: true, missing: [], present };
}

function checkMigrations() {
  console.log('🔍 Checking Supabase migrations...');

  const migrationsPath = path.join(process.cwd(), CHECKS.migrationsDir);

  if (!fs.existsSync(migrationsPath)) {
    console.error(`❌ Migrations directory not found: ${CHECKS.migrationsDir}`);
    return { passed: false, count: 0 };
  }

  const files = fs.readdirSync(migrationsPath);
  const migrationFiles = files.filter((f) => f.endsWith('.sql'));

  if (migrationFiles.length === 0) {
    console.warn(`⚠️  No migration files found in ${CHECKS.migrationsDir}`);
    return { passed: true, count: 0 };
  }

  console.log(`✅ Found ${migrationFiles.length} migration files`);

  // Check for audit_logs migration
  const hasAuditLogs = migrationFiles.some((f) => f.includes('audit_log'));
  const hasCheckpoints = migrationFiles.some((f) => f.includes('checkpoint'));

  if (!hasAuditLogs) {
    console.warn(`⚠️  No audit_logs migration found`);
  }

  if (!hasCheckpoints) {
    console.warn(`⚠️  No checkpoints migration found`);
  }

  return { passed: true, count: migrationFiles.length };
}

function checkDependencies() {
  console.log('🔍 Checking dependencies...');

  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.error(`❌ package.json not found`);
    return { passed: false };
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  const requiredDeps = [
    '@supabase/supabase-js',
    'yjs',
    'zustand',
    'next',
  ];

  const missing = [];

  for (const dep of requiredDeps) {
    const hasDep =
      packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
    if (!hasDep) {
      missing.push(dep);
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Missing required dependencies:`);
    missing.forEach((d) => console.error(`   - ${d}`));
    return { passed: false, missing };
  }

  console.log(`✅ All required dependencies present`);
  return { passed: true, missing: [] };
}

function checkBuild() {
  console.log('🔍 Checking production build...');

  try {
    execSync('npm run build', {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    console.log('✅ Production build successful');
    return { passed: true };
  } catch (error) {
    console.error(`❌ Production build failed`);
    console.error(error.stderr || error.message);
    return { passed: false };
  }
}

function checkTypes() {
  console.log('🔍 Checking TypeScript...');

  try {
    execSync('npm run type-check', {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    console.log('✅ TypeScript check passed');
    return { passed: true };
  } catch (error) {
    console.error(`❌ TypeScript check failed`);
    console.error(error.stdout || error.message);
    return { passed: false };
  }
}

function checkTests() {
  console.log('🔍 Running tests...');

  try {
    const output = execSync('npx vitest run tests/unit/ --reporter=verbose', {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 120000,
    });

    const passedMatch = output.match(/Tests\s+(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);

    const passed = parseInt(passedMatch?.[1] || '0', 10);
    const failed = parseInt(failedMatch?.[1] || '0', 10);

    if (failed > 0) {
      console.error(`❌ Tests failed: ${failed} failures`);
      return { passed: false, passed, failed };
    }

    console.log(`✅ All tests passed (${passed})`);
    return { passed: true, passed, failed: 0 };
  } catch (error) {
    console.error(`❌ Test execution failed`);
    console.error(error.stdout || error.message);
    return { passed: false, passed: 0, failed: 0 };
  }
}

function checkBundleSize() {
  console.log('🔍 Checking bundle size...');

  const nextDir = path.join(process.cwd(), '.next');
  if (!fs.existsSync(nextDir)) {
    console.warn(`⚠️  No .next directory, run build first`);
    return { passed: true, size: 0 };
  }

  const staticDir = path.join(nextDir, 'static', 'chunks');
  if (!fs.existsSync(staticDir)) {
    console.warn(`⚠️  No static chunks found`);
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

  if (sizeKB > CHECKS.maxBundleSizeKB) {
    console.warn(`⚠️  Bundle size ${sizeKB}KB exceeds ${CHECKS.maxBundleSizeKB}KB limit`);
    return { passed: false, size: sizeKB };
  }

  console.log(`✅ Bundle size ${sizeKB}KB (limit: ${CHECKS.maxBundleSizeKB}KB)`);
  return { passed: true, size: sizeKB };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('PRE-FLIGHT CHECK FOR DEPLOYMENT');
  console.log('='.repeat(70) + '\n');

  const startTime = Date.now();
  const results = [];

  // Run all checks
  const checks = [
    { name: 'Environment Variables', fn: checkEnvVars },
    { name: 'Required Files', fn: checkRequiredFiles },
    { name: 'Supabase Migrations', fn: checkMigrations },
    { name: 'Dependencies', fn: checkDependencies },
    { name: 'TypeScript', fn: checkTypes },
    { name: 'Tests', fn: checkTests },
    { name: 'Production Build', fn: checkBuild },
    { name: 'Bundle Size', fn: checkBundleSize },
  ];

  for (const check of checks) {
    console.log(`\n📋 ${check.name}`);
    console.log('-'.repeat(70));

    try {
      const result = check.fn();
      results.push({ name: check.name, ...result });
    } catch (error) {
      console.error(`❌ Check failed with error: ${error.message}`);
      results.push({ name: check.name, passed: false, error: error.message });
    }
  }

  // Summary
  const duration = Date.now() - startTime;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  results.forEach((r) => {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${r.name}`);
  });

  console.log('-'.repeat(70));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`Duration: ${duration}ms`);
  console.log('='.repeat(70) + '\n');

  // Exit code
  if (failed > 0) {
    console.log('❌ Pre-flight check FAILED - Deployment blocked\n');
    process.exit(1);
  } else {
    console.log('✅ Pre-flight check PASSED - Ready for deployment\n');
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main, checkEnvVars, checkTests, checkBuild };
