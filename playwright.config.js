import { defineConfig, devices } from '@playwright/test';

// Phase 3 — one suite over every deck in decks.json, against the built site.
// Visual regression (tests/visual.spec.js) is excluded here and run on its own
// (npm run visual) because pixel baselines are platform-specific; CI runs it in
// Playwright's container image so the writer and the comparer match.
export default defineConfig({
  testDir: './tests',
  testIgnore: process.env.VISUAL ? undefined : ['**/visual.spec.js'],
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
      threshold: 0.2
    }
  },
  use: { baseURL: 'http://localhost:4321' },
  webServer: {
    command: 'npm run preview -- --port 4321',
    url: 'http://localhost:4321/decks/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
