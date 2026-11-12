// Phone fit gate: every deck must read cleanly at 390×844. The contract is
// the mobile half of the frame law (SYSTEM.md §5/§8): columns stack, scenes
// may scroll vertically, but nothing overflows horizontally and no scene is
// cut off sideways. Desktop snap-fit stays in tests/fit.spec.js.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const { decks } = JSON.parse(readFileSync(new URL('../decks.json', import.meta.url), 'utf8'));
const route = (d) => d.route ?? (d.migrated ? `decks/${d.slug}/` : `${d.slug}.html`);

for (const deck of decks) {
  test(`${deck.slug}: no horizontal overflow at 390×844`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route(deck), { waitUntil: 'load' });
    await page.waitForTimeout(350);
    const over = await page.evaluate(() => {
      const bad = [];
      const doc = document.documentElement;
      if (doc.scrollWidth > window.innerWidth + 1) {
        bad.push(`document (${doc.scrollWidth}px)`);
      }
      const st = document.querySelector('deck-stage');
      for (const s of st.scenes) {
        const inner = s.querySelector('.scene-inner');
        if (!inner) continue;
        const w = Math.round(inner.getBoundingClientRect().width);
        // scene-inner spans the scene's content box; wider than the viewport
        // means content is cut off sideways with no way to reach it.
        if (w > window.innerWidth + 1) bad.push(`${s.id} (${w}px)`);
      }
      const nav = st.querySelector('nav');
      if (nav && nav.scrollWidth > window.innerWidth + 1) {
        bad.push(`nav (${nav.scrollWidth}px)`);
      }
      return bad;
    });
    expect(over, `overflowing horizontally: ${over.join(', ')}`).toEqual([]);
  });
}
