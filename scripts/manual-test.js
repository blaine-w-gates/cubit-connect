#!/usr/bin/env node
/**
 * Manual Sync Test Runner
 * 
 * Run this script to open two browser windows for manual sync testing.
 * It captures console logs and exposes them for analysis.
 * 
 * Usage: node scripts/manual-test.js
 * 
 * This script:
 * 1. Starts the dev server
 * 2. Opens two Chrome windows (simulating Computer + iPad)
 * 3. Captures all console logs from both
 * 4. Saves logs to files for review
 * 5. Provides a URL you can open manually on real devices
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
/* eslint-enable @typescript-eslint/no-require-imports */

const TEST_PASSPHRASE = 'manual-test-2024';
const SYNC_SERVER = 'wss://cubit-sync-relay.onrender.com';
const LOG_DIR = path.join(__dirname, '..', 'test-logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(LOG_DIR, `manual-test-${timestamp}.log`);

console.log('🚀 Manual Sync Test Runner');
console.log('==========================');
console.log('');
console.log('This will:');
console.log('1. Start the dev server');
console.log('2. Open two Chrome windows (Device A + Device B)');
console.log('3. Capture all console logs');
console.log('4. Wait for you to perform actions');
console.log('');
console.log('Press Ctrl+C to stop');
console.log('');

const logs = [];

function log(source, message) {
  const entry = `[${new Date().toISOString()}] [${source}] ${message}`;
  logs.push(entry);
  console.log(entry);
  // Append to file
  fs.appendFileSync(logFile, entry + '\n');
}

async function main() {
  // Start dev server
  console.log('📦 Starting dev server...');
  const devServer = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    shell: true
  });

  let serverReady = false;
  devServer.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Ready') || output.includes('3000')) {
      if (!serverReady) {
        serverReady = true;
        console.log('✅ Dev server ready on http://localhost:3000');
        startBrowsers();
      }
    }
  });

  devServer.stderr.on('data', (data) => {
    console.error('Dev server error:', data.toString());
  });

  async function startBrowsers() {
    console.log('🎭 Opening browsers...');
    
    const browser = await chromium.launch({
      headless: false,
      args: ['--window-size=1280,900']
    });

    // Create shared context for same-room simulation
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 }
    });

    // Device A (Computer)
    const pageA = await context.newPage();
    pageA.on('console', msg => {
      const text = `[A] ${msg.type()}: ${msg.text()}`;
      log('Device-A', text);
    });
    pageA.on('pageerror', err => {
      log('Device-A', `[A] ERROR: ${err.message}`);
    });

    // Device B (iPad simulation)
    const pageB = await context.newPage();
    pageB.on('console', msg => {
      const text = `[B] ${msg.type()}: ${msg.text()}`;
      log('Device-B', text);
    });
    pageB.on('pageerror', err => {
      log('Device-B', `[B] ERROR: ${err.message}`);
    });

    // Navigate both to app
    console.log('🌐 Navigating Device A...');
    await pageA.goto('http://localhost:3000/todo');
    
    console.log('🌐 Navigating Device B...');
    await pageB.goto('http://localhost:3000/todo');

    // Setup sync for both
    await setupDevice(pageA, 'Device-A');
    await setupDevice(pageB, 'Device-B');

    console.log('');
    console.log('✅ Both devices ready!');
    console.log('');
    console.log('📱 Device A (left) and Device B (right) are connected');
    console.log('🔑 Using passphrase:', TEST_PASSPHRASE);
    console.log('');
    console.log('🧪 Test Instructions:');
    console.log('1. Click "Join Sync" on both devices');
    console.log('2. Enter passphrase:', TEST_PASSPHRASE);
    console.log('3. Add a task on Device A - watch Device B');
    console.log('4. Add a task on Device B - watch Device A');
    console.log('');
    console.log('📊 Logs being saved to:', logFile);
    console.log('');
    console.log('Press Ctrl+C to stop and save full logs');
    console.log('');

    // Keep alive
    await new Promise(() => {});
  }

  async function setupDevice(page, name) {
    // Wait for hydration
    await page.waitForFunction(() => {
      const store = window.__STORE__;
      return store?.getState()?.isHydrated;
    }, { timeout: 30000 });

    // Inject API key and sync server
    await page.evaluate((passphrase, server) => {
      localStorage.setItem('cubit_api_key', btoa('manual-test-key'));
      localStorage.setItem('sync_server_url', server);
    }, TEST_PASSPHRASE, SYNC_SERVER);

    log(name, 'Setup complete - ready for sync');
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping...');
    devServer.kill();
    
    // Save full log summary
    const summaryFile = path.join(LOG_DIR, `summary-${timestamp}.txt`);
    const summary = `
Manual Test Summary
===================
Timestamp: ${new Date().toISOString()}
Passphrase: ${TEST_PASSPHRASE}
Log File: ${logFile}

Key Events:
${logs.filter(l => l.includes('OBSERVER') || l.includes('NETWORK') || l.includes('SYNC')).join('\n')}

Full logs available at: ${logFile}
`;
    fs.writeFileSync(summaryFile, summary);
    console.log('📄 Summary saved to:', summaryFile);
    
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
