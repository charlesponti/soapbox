# Soapbox — the scratchpad

Running list of things to generalize and things to build. Not a spec
(`SYSTEM.md` is the spec); this is the workshop bench. Newest thinking at the
top of each section.

Legend: **P0** next · **P1** soon · **P2** someday · 🔥 obviously good.

---

## Components to generalize (library-first, SYSTEM.md §10)

Building six decks in one sitting showed exactly what repeats. Usage counts are
across the current six decks.

| Candidate | Replaces | Decks using it | Priority |
|---|---|---|---|
| `<deck-machine>` + `<deck-part>` | `.machine`/`.mlabel`/`.mpart` | **6/6** | P0 🔥 |
| `<deck-scene>` | `.scene` + `.scene-inner` + `.eyebrow` + layout | 6/6 | P0 🔥 |
| `<deck-flow>` | `.flow`/`.flowbox`/`.flowarr` | 5/6 | P0 |
| `<deck-stack>` (nodes + connectors) | `.stack`/`.node`/`.connector` | 3/6 | P0 |
| `<deck-code>` | `.code` + `.kw`/`.cm` | 5/6 | P0 |
| `<deck-compare>` | `.cols`/`.col` | 4/6 | P1 |
| `<deck-chips>` (sequence of chips) | `.badges`/`.badge` | 3/6 | P1 |
| `<deck-grid>` (card grid) | `.blocks`/`.block` | 3/6 | P1 |
| `<deck-verdict>` (the semantic accent) | `.verdict`/`.v` | 3/6 | P1 |
| `<deck-cycle>` (rotating highlight) | `.loop`/`.loopnode` | 3/6 | P1 |
| `<deck-metrics>` (data table) | `.metrics`/`.mrow` | 2/6 | P1 |
| `<deck-counter>` | `.bignum`/`.jobbar` | 1/6 | P2 |
| `<deck-tiles>` (word-object) | `.tiles`/`.tile` | 1/6 | P2 |
| `<deck-trace>` (a scored trace) | — | 2/6, growing | P1 🔥 |

**Why `<deck-scene>` matters most.** Every deck writes the same boilerplate —
`<section class="scene" id="sN"><div class="scene-inner layout"><div>` plus an
eyebrow with a hand-typed `STEP n / N`. That hand-typed total is a bug factory
(I shipped `/8` on a nine-scene deck twice today). A component should:

```html
<deck-scene id="s4" step="4" title="THE CONVERSATION" layout="split">
  <div>…headline, lede, replay button…</div>
  <div>…diagram…</div>
</deck-scene>
```

and compute the eyebrow, the `.layout` grid, and registration with the stage.

**Why `<deck-machine>` next.** It is in every narrative deck, and its parts are
just data: `<deck-part name="EYES" note="Sees chunks" state="installed" step="1">`.
Declaring the machine once per scene as a list would kill ~40 lines of markup per
scene and the copy-paste drift in the notes.

**Build wiring should go declarative too.** Today every deck repeats
`builders = {...}; querySelectorAll('[data-replay]').forEach(...)`. A
`data-build="states"` attribute + a single registration call in the layout would
remove it. Then `check-decks` can verify builds without regex.

**`<deck-chat>` is done** — the phone with the lifecycle. The streamchat legacy
phone is fully covered by it now.

---

## Stage / presenter features

- **P0 🔥 Presenter view.** A second window (`?present`): next scene preview,
  current cue enlarged, a wall clock + per-deck elapsed timer, scene list. This
  is the single biggest upgrade for actually *presenting* rather than scrolling.
- **P0 🔥 Overview mode (`O`).** Grid of scene thumbnails; click to jump. Live
  navigation without scrubbing.
- **P1 Scene dots in the nav.** Twelve small dots; current one filled. Instant
  orientation + a place to click.
- **P1 Clicker/remote support.** Space / PageUp / PageDown / `B` (blank), plus
  pointer-gesture nav (tap right third = next). Presenters use clickers, not
  arrow keys.
- **P1 Self-opening links to a beat.** `#s3` exists; add `#s3@1200` to pause a
  specific animation frame for review comments.
- **P2 Transitions between scenes.** Fades/rises on navigate — off by default,
  a `transition` attribute to opt in. Must not violate the "nothing moves
  uninvited" law.
- **P2 Blank/blackout (`B`).** For talk-to-camera moments.
- **P2 Live "replay all" (`Shift+R`).** Run every scene's build in order for a
  dry run.

## Content pipeline (the PoC endgame)

- **P0 🔥 One timeline, three consumers.** A per-deck `timeline` (scene, beat,
  cue, narration offset) that drives: the deck (autoplay), the PoC capture
  (frame timing), and the YouTube chapter markers. Today the cue list, the beat
  constants and `poc/manifest.json` are three truths.
- **P0 Autoplay / timeline mode (`?play`).** A deck that advances and fires each
  build on the manifest — the "slides that perform themselves" demo, now for
  every deck.
- **P1 `npm run new -- --essay essays/06-foo.md`.** Scaffold a deck page (frontmatter,
  cue stubs, scene skeleton) from the essay's headings. Turns a 3-hour authoring
  pass into an editing pass.
- **P1 `build.mjs`.** script + timeline → rendered MP4 (chunk render → measure →
  drive → capture → mux → chapters). Generalize `poc/` from one cue to a deck.
- **P2 TTS narration from the cue text**, measured for durations, feeding the
  timeline — so the deck and the audio can never drift.

## Quality / CI

- **P0 🔥 Visual regression.** Playwright `toHaveScreenshot` per scene in CI.
  The suite proves the DOM; nothing proves the *picture*.
- **P0 Extend `check-decks`:** the word ceiling per scene, the **accent audit**
  (colour only in sanctioned components), duplicate `data-replay` values, one
  replay button per build, and an `h1`/landmark presence check.
- **P1 axe + Lighthouse budgets** in CI (contrast, headings, load size).
- **P1 `reduced-motion` screenshot set** kept as artifacts, so the accessibility
  path is visible, not assumed.
- **P2 Offline/deck integrity test:** assert no deck fetches a remote asset
  (fonts, motion) — the render path must be self-contained for the pipeline.

## Brand / studio

- **P1 Self-host Geist + Geist Mono** (woff2 in `components/fonts/`). Removes the
  last CDN dependency, fixes offline render, and speeds first paint.
- **P1 OG images per deck.** Generate from scene 1 at build; add `og:` meta so
  every shared link unfurls. Pairs with the hash links already shipped.
- **P1 Series index polish.** Episode number, a one-line summary, and a scene
  count per deck; group by season.
- **P2 `<deck-mark>`.** Formalize the Monotone red square (cover/close) as a
  component, including the sanctioned placement from the accent law.
- **P2 Portrait / social cuts.** A `9:16` variant of key scenes for Shorts.
- **P2 Sound design hooks.** Opt-in, presenter-triggered whooshes on scene
  transitions — never on scroll.
- **P2 Printable handout export.** One scene per page, monochrome, for in-room
  use.
