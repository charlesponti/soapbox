# AGENTS.md — operating manual for agent sessions

This repo is one Astro site with two halves: **essays** (from the local vault,
served at `/`) and **decks** (the YouTube slide system, served under `/decks/`;
spec in `SYSTEM.md`). Everything below about the vault applies to the essays.

Concise ground rules for working in this repo. Durable knowledge lives in
`docs/` (`development.md`, `deployment.md`, `testing.md`); update those when
things land.

## Hard constraints

- **The vault is local-only, forever.** `~/Developer/vault/notes` has no remote
  and must never get one. Content never leaves this machine except as built
  static pages via `npm run deploy` (which uploads `dist/` to Railway). Never
  push, add remotes, or copy vault content out beyond the normal
  `filekit stage` → `staged/` → `dist/` → Railway flow.
- **Vault content never goes through git or CI.** `staged/` is gitignored and
  stays that way. This repo has a GitHub remote (soapbox), and CI builds the
  decks with zero essays (the loader tolerates a missing `staged/`). Real
  deploys are a local build + push of artifacts (`scripts/deploy.sh`); there is
  no Pages deploy anymore.
- **The site is publicly deployed** on Railway (`web` service, project
  `lexicon`) — see `docs/deployment.md`. Anything `status: published` in the
  vault is public once `npm run deploy` runs.
- The vault is the source of truth. The site only _reads_ it via
  `filekit frontmatter stage` (see `package.json` scripts). Never edit
  `staged/*` or `dist/*` directly — they are generated.
- Editing a note's frontmatter (status, category, tags) is done **in the vault**
  with `filekit frontmatter set/remove`, then re-staged.

## Deployment

- Public URL: `https://web-production-02a47.up.railway.app`
- `npm run deploy` = `scripts/deploy.sh` → builds locally (gates + stage +
  astro + pagefind), then `railway up --no-gitignore` uploads the repo root and
  the `Dockerfile` (nginx) serves `dist/`. nginx replaces Railway's built-in
  static hosting, whose injected CSP blocks Pagefind WASM (`wasm-unsafe-eval`).
  The vault stays on this machine.
- Railway IDs live in `scripts/deploy.sh`; service config/domains are managed
  on Railway (domain is pinned to target port 80). To publish an essay, flip it
  in the vault and `npm run deploy`.
- See `docs/deployment.md` for the full strategy, rollback, and custom-domain
  notes. Deeper build/gotcha knowledge: `docs/development.md`.

## How the site is built

1. `filekit frontmatter stage --where type=essay status=published` copies
   published essays (frontmatter `status: published`) into `staged/*.md`.
2. `src/loaders/essays.ts` (custom content-layer loader `vault-essays`) reads
   `staged/`, normalizes frontmatter, and calls `store.clear()` on load.
3. Astro renders static pages; `pagefind` builds the search index over `dist/`.

Only essays with vault frontmatter `status: published` are staged (88 as of
Aug 2026; the rest are `status: draft` and excluded by the gate).
To publish more: `filekit frontmatter set --file <vault-note> --field status
--value published`, then `npm run deploy`.

## Commands

```bash
npm run dev       # portless → stage → astro dev at https://soapbox.lvh.me:4200
npm run build     # stage → astro build → pagefind (gates run first, see below)
npm run deploy    # build locally + push to Railway (see docs/deployment.md)
npm run preview   # serve dist/ :4321 — RESTART after every rebuild
npm run check:astro # astro check (expect 0 errors)
npm run check     # deck lint over dist/ (needs a build first)
npm test          # deck Playwright suite (needs a preview server on :4321)
npm run typecheck # tsc --noEmit
npm run lint      # oxlint --fix
npm run gates     # check + typecheck — runs automatically
node tests/search-check.mjs   # regression gate; needs build + preview
```

**Gates are wired into the workflow** — don't skip them, but you don't have to
remember to run them: `npm run build` runs `gates` first (via `prebuild`), and
the tracked `.githooks/pre-commit` hook runs the same three checks before every
commit (installed by `prepare` / `scripts/install-hooks.mjs`). The heavy
integration gate (build + pagefind + search-check) still needs a running
preview server, so it stays manual.

**Always finish with:** `npm run build`, `npm run check`, `npm run typecheck`,
and (with a preview server up) `node tests/search-check.mjs`.

## Gotchas (don't re-derive)

- Custom content loaders must return `rendered` (via `context.renderMarkdown`).
- `npm run dev` serves NO search index — search only exists in a built site.
  For search, run `npm run build && npm run preview` (or `search-check.mjs`).
- Astro's content store persists across builds — a shrinking stage set REQUIRES
  `store.clear()` in the loader, or removed essays linger.
- `astro preview` serves stale `dist/`; restart it after every rebuild. Under an
  agent it daemonizes, so Playwright's `webServer` exits early: run
  `npx astro preview --port 4321` first, then `npm test`.
- `npm run stage` needs `$STUDIO_PRESS_ROOT` set (publishing workspace root); unset, it stages 0 files. Staged from `$STUDIO_PRESS_ROOT/charlesponti/essays`.
- `astro check` requires TypeScript ≤ 6 (TS 6.0.3 is deliberate).
- Pagefind facets: inline `data-pagefind-filter="key:value"`; the old `-value`
  attribute is gone. Its runtime is pure-ESM — import with `@vite-ignore`.
- React 19: don't `flushSync` a controlled input inside `onChange`.
- The reading progress bar is a static `transition:persist` div in
  `BaseLayout`; JS-created DOM does not survive the ClientRouter body swap.
- View-transition named snapshots always paint above the root capture (see
  `docs/development.md`); frozen controls need `opacity: 0` on their old
  snapshots, not just `animation: none`.
- Markdown: Sätteri is the processor (Astro 7 default) via `satteri()` in
  `astro.config.mjs` — no custom mdast plugins, no unified() bridge.
- `prepare` (npm install) runs `scripts/install-hooks.mjs`, which points git at
  `.githooks/`. Add new hooks there; re-run the script if git stops firing them.

## File map

- `src/loaders/essays.ts` — content loader (stage ingestion, `store.clear()`).
- `src/content.config.ts` — essay collection schema (no `status` field).
- `src/pages/index.astro`, `src/pages/essays/[slug].astro`, `src/pages/404.astro`.
- `src/pages/decks/*` + `src/layouts/{Deck,Site}.astro` — the deck pages; deck
  assets (`components/`, `og/`) are served from the site root.
- `src/components/` — React islands (`TopicSelect`, `EssayList`) + Astro comps.
- `src/client/` — `list-transition.ts`, `progress.ts`.
- `.githooks/` — tracked git hooks (`pre-commit` runs `npm run gates`).
- `scripts/` — `deploy.sh` (build + push to Railway), `install-hooks.mjs`,
  `prune-pagefind.mjs`.
- `Dockerfile` + `nginx.conf` — deploy-time static server (replaces Railway's
  built-in static hosting, whose CSP blocks Pagefind WASM). `.railwayignore`
  trims the upload.
- `tests/search-check.mjs` — 15-assertion regression gate (Pagefind + navigation).
