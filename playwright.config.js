import { defineConfig, devices } from '@playwright/test';

// Phase 3 — one suite over every deck in decks.json, against the built site.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4321' },
  webServer: {
    command: 'npm run preview -- --port 4321',
    url: 'http://localhost:4321/soapbox/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
