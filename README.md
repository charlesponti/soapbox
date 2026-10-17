# Soapbox — the YouTube Slide System

The standard slide system for all of Chase's YouTube videos — full-screen
HTML scenes the presenter talks over. Black & white, Geist, Motion, Lucide.

- **`SYSTEM.md`** — the spec: design law, accent law, typography, motion
  patterns + the progressive beat, presenter machinery, scene catalogue,
  the narrative build-order pattern, the stage/components, and the build.
  Read this first.

## The site

Each presentation is its own page, built with Astro. A deck is a `<deck-page>`
that supplies only its cues and scenes; the shared shell lives in
`src/layouts/Deck.astro`.

```
npm install
npm run dev        # local dev server (http://localhost:4321/soapbox/)
npm run build      # static build → dist/
npm run preview    # serve dist/ at the configured base
```

- **`decks.json`** — the series manifest (slug, title, brand, series, accent,
  migrated flag). Single source for the index page, the checks, and the video
  pipeline.
- **`src/pages/`** — one Astro page per presentation (`next-token.astro`, …)
  plus `index.astro` (the series index).
- **`src/layouts/Deck.astro`** — the head (fonts, favicon, `deck.css`, vendored
  Motion) and the `<deck-stage>` wrapper. Appendices: `<style slot="head">` for
  a deck's scene primitives, `<script slot="script">` for its build functions.
- **`components/`** — the reusable web-component library (`deck.css` +
  `deck-icon.js` + `deck-stage.js` + `deck-chat.js`) and the vendored Motion
  build. This is the canonical library and is **not** owned by Astro: a config
  hook mirrors it into `public/components` for dev and `dist/components` for the
  build.
- **Static decks at the repo root** (`the-tool-call.html`, `stage-poc.html`,
  `streamchat-offline.html`) predate the Astro layer and are copied into the
  build output, so the published site is a superset while decks migrate.

Published site: https://charlesponti.github.io/soapbox/
The flagship deck: https://charlesponti.github.io/soapbox/next-token/
Scroll it; `C` toggles speaker cues, `R` replays the active scene, and every
scene is a shareable `#hash` link.
