# Development — soapbox (essays + decks)

How the site is built and maintained. Deployment is covered in
`docs/deployment.md`; testing in `docs/testing.md`. `AGENTS.md` is the concise
operating manual for agent sessions; this document is the durable knowledge.

## Stack

- Astro 7.2.9 (static output) · TypeScript 6.0.3 (deliberate — `astro check`
  requires TS ≤ 6) · Tailwind v4 · React 19 islands
- Pagefind 1.5.2 (search) · Sätteri (Astro's default markdown engine) · Zod 4
  (content schema)
- Geist type, dark-only, B/W-only, shadcn-neutral tokens

## Build pipeline

```
~/Developer/vault/notes (source of truth; local-only)
      │  filekit frontmatter stage --where type=essay status=published
      ▼
staged/*.md   (slug-named copies of published essays; generated, never edited)
      │  src/loaders/essays.ts  (custom content-layer loader "vault-essays")
      ▼
dist/  (static HTML + Pagefind index; generated, never edited)
```

- **Publish gate** = frontmatter `status: published` on the vault note. 88
  essays are published as of Aug 2026; the rest are `status: draft` and drop
  out of the stage set. Flip more with `filekit frontmatter set`, then
  `npm run deploy`.
- The loader normalizes frontmatter at load time (title/H1 fallback, ISO dates,
  word count, duplicate-H1 strip) so the collection schema stays strict.
- **Custom loaders must return `rendered`** via `context.renderMarkdown`, or
  body-only essays render an empty `<article>`.
- **The loader MUST call `store.clear()` on load.** Astro's content store
  persists across builds, so a shrinking stage set (e.g. an essay flipped back
  to draft) leaves stale entries behind without it.
- **Search indexing is scoped and pruned.** Essay pages mark the article
  `<main>` as `data-pagefind-body` (category filter on the same element), so
  Pagefind ignores the logo/back-link chrome and the 404 page. After `pagefind
--site dist`, `scripts/prune-pagefind.mjs` strips the unused UI/highlighter
  bundles and the `wasm.unknown` fallback (~475 KB). This runs in `build`.
  See "Search index weight" below.

## Commands

```bash
npm run dev       # portless → stage → astro dev at https://soapbox.lvh.me:4200
npm run build     # stage → astro build → pagefind --site dist
npm run preview   # serve dist/ :4321 — RESTART after every rebuild
npm run deploy    # build locally + push to Railway (see docs/deployment.md)
npm run check     # astro check (0 errors expected)
npm run typecheck # tsc --noEmit
npm run lint      # oxlint --fix
npm run gates     # check + typecheck — runs automatically
```

## Design decisions (why it is the way it is)

- **Markdown is plain Sätteri:** `astro.config.mjs` uses `processor: satteri()`
  with no custom mdast plugins. The site previously shipped a wikilink
  transform (`[[path|label]]` → essay links / ghost spans) as a native Sätteri
  mdast plugin, with a parity harness comparing it against the retired
  unified() pipeline. No published essay contained a wikilink, so the feature
  was removed wholesale in Aug 2026 — `[[...]]` in any essay body renders as
  literal text. If cross-essay links are ever wanted, re-add a small
  `defineMdastPlugin` in `astro.config.mjs`; nothing in the build depends on it.
- **Gates are wired in:** `npm run gates` (check + typecheck) runs as
  `prebuild` before every build and as a tracked pre-commit hook
  (`.githooks/pre-commit`, installed by `prepare`/`scripts/install-hooks.mjs`
  → `git config core.hooksPath`). The heavy integration gate (build + pagefind
  - search-check) still needs a preview server, so it stays manual.
- **Filter transitions:** only the essay list morphs; controls are frozen via
  JS-scoped view-transition-names (`src/client/list-transition.ts`) applied for
  the duration of a list transition and cleared on finish. Cross-document
  navigation is a clean root crossfade. The trap that caused this: named
  snapshots always composite above the root capture, and `:only-type()` is
  unsupported by Lightning CSS and Chromium 151.
- **Essay-page polish:** tag pills get a native entry animation
  (`@starting-style` transition + `--reveal-delay` stagger, no JS); the topic
  badge label is a button that reopens the picker at the same scroll position
  (`setOpenKeepScroll` in `TopicSelect.tsx`).
- **zod import:** `z` is imported from `zod` directly — Astro's re-export from
  `astro:content` is deprecated (warns under `astro check`).
- **lint:** oxlint (Rust-based) via `npm run lint`; pinned as a devDependency.
- **Search index weight:** at 88 essays the raw Pagefind bundle was ~1.2 MB, of
  which ~475 KB was dead weight: Pagefind 1.5.x always emits its Default UI,
  Component UI, Modular UI, and highlighter modules, but lexicon's custom React
  search island only imports `/pagefind/pagefind.js` (verified: the runtime
  never references the UI modules). `scripts/prune-pagefind.mjs` removes them
  plus the `wasm.unknown.*` fallback (every page is `lang="en"`), taking the
  bundle to ~784 KB. Pagefind 1.5.2 has no `--min`/`segments`/`excerpt` flags,
  so the remaining `index/` + `fragment/` (~600 KB) scale with corpus and are
  otherwise irreducible; `excerpt_with_markup` in the search UI needs the
  fragment index, so don't disable it.
- **Content data:** `pubDate` was removed from all vault notes (341 notes,
  surgical). The loader yields null dates → essays show "undated" and the index
  sorts alphabetically by title. If dates return, re-add the field and the
  `byNewest` sort picks it back up.

## Gotchas (don't re-derive)

- `astro preview` serves stale `dist/`; restart it after every rebuild.
- Pagefind 1.5.2 facets: inline `data-pagefind-filter="key:value"`; the old
  `…-value` attribute is gone. The pagefind runtime is pure-ESM with named
  exports — import it with `@vite-ignore` + `@ts-expect-error`; a `<script>`
  tag throws (`import.meta` outside a module).
- React 19: don't `flushSync` a controlled input inside `onChange` (the value
  tracker drops keystrokes). Search typing batches normally; the _results_ land
  through the list transition.
- View-transition named snapshots always paint above the root capture — affects
  both layout (intercepting clicks, cf. `topics-pop`) and navigation (frozen
  index header over essay header).
- Frozen controls during list transitions need `opacity: 0` on their
  `::view-transition-old(*)` snapshots, not just `animation: none`: the stale
  old capture lingers at full opacity and the trigger's semi-transparent
  background lets the old label read through the new one for the transition.
- JS-created DOM does not survive the ClientRouter body swap: the reading
  progress bar is a static `<div id="progress" transition:persist>` in
  `BaseLayout`, and `progress.ts` attaches its listeners once (window-guarded)
  and recomputes on `astro:page-load`.
- `prepare` (install) runs `scripts/install-hooks.mjs`, which points git at
  `.githooks/`. Add new hooks there; re-run the script if git stops firing them.

## File map

- `src/loaders/essays.ts` — content loader (stage ingestion, `store.clear()`).
- `src/content.config.ts` — essay collection schema (no `status` field).
- `src/pages/index.astro`, `src/pages/essays/[slug].astro`, `src/pages/404.astro`.
- `src/components/` — React islands (`TopicSelect`, `EssayList`) + Astro comps.
- `src/client/` — `list-transition.ts`, `progress.ts`.
- `scripts/` — `deploy.sh`, `install-hooks.mjs`, `prune-pagefind.mjs`.
- `.githooks/` — tracked git hooks (`pre-commit` runs `npm run gates`).
- `tests/search-check.mjs` — 15-assertion regression gate (Pagefind + nav).
