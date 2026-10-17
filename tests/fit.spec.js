// Every scene must fit a 16:9 projector. This is the "killer presentation"
// gate: a scene taller than the viewport gets its bottom (usually the payoff
// diagram or the end card) cut off by the snap scroll.
//
// FIT_DEBT lists decks that still overflow — cleared as each deck is reworked.
// Add nothing to it; remove entries as you go.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const { decks } = JSON.parse(readFileSync(new URL('../decks.json', import.meta.url), 'utf8'));
const FIT_DEBT = new Set([
  'the-tool-call',
  'confirmation-is-a-protocol',
  'what-your-eval-is-measuring',
  'models-fail-differently',
  'the-personal-agent-is-a-typed-capability-system'
]);
const route = (d) => (d.migrated ? `/soapbox/${d.slug}/` : `/soapbox/${d.slug}.html`);
const PAD = 190; // .scene top+bottom padding at 1600×900

for (const deck of decks) {
  test(`${deck.slug}: every scene fits 1600×900`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(route(deck), { waitUntil: 'load' });
    await page.waitForTimeout(350);
    const over = await page.evaluate((pad) => {
      const st = document.querySelector('deck-stage');
      const avail = window.innerHeight - pad;
      return st.scenes
        .map((s, i) => ({ id: s.id, n: i, h: Math.round(s.querySelector('.scene-inner').getBoundingClientRect().height) }))
        .filter((x) => x.h > avail)
        .map((x) => `${x.id} (${x.h}px)`);
    }, PAD);
    if (FIT_DEBT.has(deck.slug)) {
      test.info().annotations.push({ type: 'fit-debt', description: over.length ? over.join(', ') : 'clear — remove from FIT_DEBT' });
      return;
    }
    expect(over, `scenes taller than the viewport: ${over.join(', ')}`).toEqual([]);
  });
}
