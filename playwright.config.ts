import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: undefined,
  timeout: 120000,
  globalTimeout: 600000,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'off',
  },
  projects: [
    // --- Desktop Browsers ---
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
    },
    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
    },
    {
      name: 'Desktop Edge',
      use: { ...devices['Desktop Edge'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
    },
    // --- iPad / Tablet Browsers ---
    {
      name: 'iPad Safari',
      use: { ...devices['iPad (gen 7)'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
      timeout: 120000,
    },
    {
      name: 'iPad Safari Landscape',
      use: { ...devices['iPad (gen 7) landscape'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
      timeout: 120000,
    },
    {
      name: 'iPad Pro Safari',
      use: { ...devices['iPad Pro 11'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
      timeout: 120000,
    },
    {
      name: 'iPad Pro Safari Landscape',
      use: { ...devices['iPad Pro 11 landscape'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
      timeout: 120000,
    },
    // Android tablet (Chromium-based — covers Chrome, Edge, Samsung Internet layout)
    {
      name: 'Galaxy Tab',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 800, height: 1280 },
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      testIgnore: ['**/performance/**', '**/unit/**'],
      timeout: 120000,
    },
    // --- Mobile Phone Browsers ---
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
      timeout: 120000,
    },
    {
      name: 'Mobile Safari Mini',
      use: { ...devices['iPhone SE'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
      timeout: 120000,
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testIgnore: ['**/performance/**', '**/unit/**'],
      timeout: 120000,
    },
    {
      name: 'Galaxy S21',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
      testIgnore: ['**/performance/**', '**/unit/**'],
      timeout: 120000,
    },
    // --- Performance ---
    {
      name: 'Lighthouse',
      testDir: './tests/performance',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--remote-debugging-port=9222'],
        },
      },
      fullyParallel: false,
    },
  ],
  webServer: [
    {
      command: 'npx serve -s out -l 3000',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120000,
    },
    {
      command: 'SYNC_MODE=memory node sync-server/server.js',
      url: 'http://localhost:8080/health',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120000,
    },
  ],
});
