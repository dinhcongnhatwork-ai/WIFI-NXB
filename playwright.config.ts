import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: '.tmp/playwright-results',
  use: { baseURL: 'http://127.0.0.1:3102', viewport: { width: 1440, height: 1100 }, headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'APP_SERVER_MODE=frontend NEXT_DIST_DIR=.tmp/builder-dev PORT=3102 npx next dev -H 127.0.0.1', url: 'http://127.0.0.1:3102', reuseExistingServer: true, timeout: 120000 },
});
