// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3002',
    browserName: 'chromium',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    launchOptions: { args: ['--no-sandbox'] },
    // Collect console messages and failed network requests via test hooks.
    // These will be asserted in the test.
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
