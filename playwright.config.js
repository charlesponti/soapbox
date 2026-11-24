import { defineConfig, devices } from '@playwright/test';

// One suite over every deck in decks.json, against the built site.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4321/soapbox/' },
  webServer: {
    command: 'npm run preview -- --port 4321',
    url: 'http://localhost:4321/soapbox/decks/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
