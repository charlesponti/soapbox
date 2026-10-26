// Phase 3 — the deck suite. One set of assertions, run for every deck listed in
// decks.json against the built site. This is the manual browser checking from
// the build sessions, codified.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const { decks } = JSON.parse(readFileSync(new URL('../decks.json', import.meta.url), 'utf8'));
const route = (d) => (d.migrated ? `/decks/${d.slug}/` : `/${d.slug}.html`);

for (const deck of decks) {
  test.describe(deck.slug, () => {
    test('loads clean and structurally sound', async ({ page }) => {
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));

      await page.goto(route(deck), { waitUntil: 'load' });
      await expect(page.locator('deck-stage')).toHaveCount(1);

      const info = await page.evaluate(() => {
        const s = document.querySelector('deck-stage');
        const scenes = s ? s.scenes : [];
        const ids = scenes.map((x) => x.id);
        const icons = [...document.querySelectorAll('deck-icon')];
        return {
          scenes: scenes.length,
          missingIds: ids.filter((i) => !i).length,
          uniqueIds: new Set(ids).size,
          icons: icons.length,
          iconsRendered: icons.filter((i) => i.querySelector('svg')).length
        };
      });

      expect(info.scenes).toBeGreaterThan(0);
      expect(info.missingIds, 'every scene needs an id').toBe(0);
      expect(info.uniqueIds, 'scene ids must be unique').toBe(info.scenes);
      expect(info.iconsRendered, 'every <deck-icon> must resolve').toBe(info.icons);
      expect(errors).toEqual([]);

      if (deck.migrated) {
        await expect(page.locator('deck-cue')).toHaveCount(info.scenes);
      }
    });

    test('reduced motion renders the final state', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route(deck), { waitUntil: 'load' });
      await page.waitForTimeout(250);
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll('.rise')].filter((e) => getComputedStyle(e).opacity === '0').length);
      expect(hidden, 'no .rise element may stay hidden under reduced motion').toBe(0);
    });

    test('every scene is a shareable deep link', async ({ page }) => {
      await page.goto(route(deck), { waitUntil: 'load' });
      const target = await page.evaluate(() => {
        const s = document.querySelector('deck-stage');
        return s.scenes[Math.min(3, s.scenes.length - 1)].id;
      });
      await page.goto(`${route(deck)}#${target}`, { waitUntil: 'load' });
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => {
        const s = document.querySelector('deck-stage');
        return { hash: location.hash, active: s.scenes[s.active].id };
      });
      expect(state.hash).toBe(`#${target}`);
      expect(state.active).toBe(target);
    });
  });
}

test('deck component hosts are never inline', async ({ page }) => {
  for (const deck of decks) {
    await page.goto(route(deck), { waitUntil: 'load' });
    const inline = await page.evaluate(() => {
      const skip = new Set(['DECK-ICON', 'DECK-MARK', 'DECK-CUE']);   // inline by design
      return [...document.querySelectorAll('*')]
        .filter((el) => el.tagName.startsWith('DECK-') && !skip.has(el.tagName) && getComputedStyle(el).display === 'inline')
        .map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''));
    });
    expect(inline, `${deck.slug}: inline component hosts — ${inline.join(', ')}`).toEqual([]);
  }
});

test('code cards render as blocks and never clip a line', async ({ page }) => {
  for (const deck of decks) {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(route(deck), { waitUntil: 'load' });
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('.code')]
        .filter((c) => getComputedStyle(c).display === 'inline' || c.scrollWidth > c.clientWidth + 1)
        .map((c) => `${c.id}:${getComputedStyle(c).display}/${c.scrollWidth - c.clientWidth}px`));
    expect(bad, `${deck.slug}: code card problems — ${bad.join(', ')}`).toEqual([]);
  }
});

test('a scene\'s replay control lives with its visual', async ({ page }) => {
  await page.goto('/decks/next-token/', { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const bad = await page.evaluate(() => {
    const s = document.querySelector('deck-stage');
    return s.scenes.filter((sc) => {
      const b = sc.querySelector('[data-replay]');
      if (!b) return false;
      const action = b.closest('.diagram-action');
      if (!action) return true;                                 // not moved at all
      const card = sc.querySelector('.diagram');
      return card ? !card.contains(b)                           // must be in the card
        : !action.parentElement.classList.contains('visual-stack'); // or stacked with it
    }).map((sc) => sc.id);
  });
  expect(bad, `replay control not with its visual: ${bad.join(', ')}`).toEqual([]);
});

test('a replay button invokes its registered scene build', async ({ page }) => {
  await page.goto('/decks/next-token/#s1', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.deckBuilds?.chat === 'function');
  await page.evaluate(() => {
    window.__chatReplayCalls = 0;
    window.deckBuilds.chat = () => { window.__chatReplayCalls += 1; };
  });
  await page.locator('#s1 [data-replay="chat"]').click();
  await expect.poll(() => page.evaluate(() => window.__chatReplayCalls)).toBe(1);
});

test('Train Your Own uses R to replay its scene builds without replay buttons', async ({ page }) => {
  await page.goto('/decks/train-your-own/#s3', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.deckBuilds?.vectors === 'function');
  await expect(page.locator('[data-replay]')).toHaveCount(0);
  await expect(page.locator('.deck-replay-key')).toHaveText('R REPLAY');
  const missingBuilds = await page.locator('.scene[data-build]').evaluateAll((scenes) =>
    scenes.filter((scene) => typeof window.deckBuilds?.[scene.dataset.build] !== 'function')
      .map((scene) => `${scene.id}:${scene.dataset.build}`));
  expect(missingBuilds).toEqual([]);
  await page.evaluate(() => {
    window.__vectorReplayCalls = 0;
    window.deckBuilds.vectors = () => { window.__vectorReplayCalls += 1; };
  });
  await page.keyboard.press('r');
  await expect.poll(() => page.evaluate(() => window.__vectorReplayCalls)).toBe(1);
});

test('the Next button morphs into Restart on the last scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });   // instant jumps, no scroll race
  await page.goto('/decks/next-token/', { waitUntil: 'load' });
  await page.evaluate(() => {
    const s = document.querySelector('deck-stage');
    s.goto(s.scenes.length - 1);
  });
  await page.waitForTimeout(400);
  const btn = page.locator('[data-next]');
  await expect(btn).toHaveClass(/is-restart/);
  await expect(btn).toHaveAttribute('aria-label', 'Restart deck');
  await btn.click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.querySelector('deck-stage').active)).toBe(0);
  await expect(btn).not.toHaveClass(/is-restart/);
});
