// OG share cards — render each deck's cover to a 1200×630 image in public/og/.
//
//   npm run build
//   npx astro preview --port 4321     # (or set OG_URL)
//   npm run og
//
// The images are committed (public/og/<slug>.png) so the build just copies them
// into dist/og/. Re-run this when a cover's copy changes.
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const { decks } = JSON.parse(readFileSync(new URL('decks.json', root), 'utf8'));
const base = process.env.OG_URL || 'http://localhost:4321';
const out = new URL('public/og/', root);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce'
});

for (const d of decks) {
  const url = `${base}/soapbox/${d.slug}/`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(350);
  // cover only: no presenter chrome, no scroll cue
  await page.evaluate(() => {
    document.querySelector('nav')?.remove();
    document.querySelector('.scrollcue')?.remove();
    document.querySelector('deck-site')?.remove();
  });
  const path = new URL(`${d.slug}.png`, out).pathname;
  await page.screenshot({ path, scale: 'css' });
  console.log('og:', d.slug, '→', path.replace(process.cwd() + '/', ''));
}

await browser.close();
