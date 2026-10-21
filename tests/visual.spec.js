// Visual regression — one snapshot per scene, per deck (SYSTEM.md §11).
//
// Baselines live in tests/__screenshots__/<slug>-<scene>.png and are generated
// in the SAME environment that compares them: CI runs this in Playwright's
// container image (`mcr.microsoft.com/playwright:<version>`), and locally:
//
//   npm run visual              compare
//   npm run visual:update       write / refresh baselines
//
// Rendered with prefers-reduced-motion + animations disabled and with the fonts
// self-hosted, so a snapshot is a pure function of the markup and CSS.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const { decks } = JSON.parse(readFileSync(new URL('../decks.json', import.meta.url), 'utf8'));

for (const deck of decks) {
  test.describe(deck.slug, () => {
    test('every scene matches its snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/decks/${deck.slug}/`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);

      const ids = await page.evaluate(() => [...document.querySelector('deck-stage').scenes].map((s) => s.id));
      expect(ids.length).toBeGreaterThan(0);

      for (const id of ids) {
        await page.evaluate((sceneId) => document.getElementById(sceneId).scrollIntoView(), id);
        await page.waitForTimeout(120);
        await expect(page).toHaveScreenshot(`${deck.slug}-${id}.png`);
      }
    });
  });
}
