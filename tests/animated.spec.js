// Animated diagrams — every page is a full deck: one stage, every scene with
// an id, one replay builder per interactive scene, zero script errors.
// Regression history: these pages once carried their behavior script twice
// (set:html markup + is:inline), so the second copy died with
// `SyntaxError: Identifier ... has already been declared` on every load.
import { test, expect } from '@playwright/test';

const decks = [
  { slug: 'animated-auto-deprecation', scenes: 5, builders: ['curves', 'sim180'] },
  { slug: 'animated-entity-extraction', scenes: 7, builders: ['chunks', 'graph', 'json', 'raw', 'resolve'] },
  { slug: 'animated-hybrid-search', scenes: 7, builders: ['final', 'fts', 'graph', 'kw', 'vec'] },
  { slug: 'animated-kb-intelligence', scenes: 6, builders: ['claims', 'conflicts', 'pattern', 'resolve'] },
  { slug: 'animated-knowledge-graph', scenes: 5, builders: ['build', 'path', 'traverse'] },
  { slug: 'animated-source-ingestion', scenes: 5, builders: ['pipeline', 'provenance', 'sources'] },
];

for (const d of decks) {
  test(`${d.slug} loads as a clean deck`, async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(`essays/${d.slug}/`, { waitUntil: 'load' });
    await expect(page.locator('deck-stage')).toHaveCount(1);
    const info = await page.evaluate(() => {
      const s = document.querySelector('deck-stage');
      return {
        scenes: s ? s.scenes.length : 0,
        builders: Object.keys(window.deckBuilds || {}).sort(),
      };
    });
    expect(info.scenes).toBe(d.scenes);
    expect(info.builders).toEqual(d.builders);
    expect(errors).toEqual([]);
  });
}

test('hybrid search layer replays on demand', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('essays/animated-hybrid-search/', { waitUntil: 'load' });
  await page.locator('[data-replay="vec"]').click();
  await expect(page.locator('#res-vec .rrow')).toHaveCount(3, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('knowledge graph traverses on demand', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('essays/animated-knowledge-graph/', { waitUntil: 'load' });
  await page.locator('[data-replay="traverse"]').click();
  await expect(page.locator('#cv-trav .gnode.lit')).toHaveCount(6, { timeout: 30_000 });
  expect(errors).toEqual([]);
});
