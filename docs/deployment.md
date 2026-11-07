# DEPLOY — soapbox deployment strategy (essays + decks)

Soapbox (the studio's core knowledge site) is a fully static Astro site that
is **built locally and pushed to the `gh-pages` branch**, which GitHub Pages
serves at https://charlesponti.github.io/soapbox/. This page documents the
strategy: the threat model it satisfies, the mechanism, and the operational
procedures.

## Decisions (locked)

| Decision | Choice                 | Why                                                                                       |
| -------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| Access   | **Public internet**    | The site is the studio's public knowledge surface                                         |
| Host     | **GitHub Pages**       | Free static hosting, HTTPS, zero servers to run; deploys ride the repo's existing remote  |
| Base     | **`/soapbox/`**        | Project Pages URL. Every absolute link in the repo must be base-aware (see gotcha below)  |
| Build    | **Local build + push** | The vault (`~/Developer/vault/notes`) is the source of truth and never leaves the machine |

The two hard constraints that drive everything:

1. **The vault never leaves this machine.** It has no git remote and never gets
   one. Only built, static pages (rendered HTML + Pagefind index) are uploaded.
2. **No CI publishing.** Deploys are an explicit human-triggered local command
   (`npm run deploy`). This is a feature, not a gap: CI never sees the vault,
   so a CI-built site would ship with zero essays — publishing requires the
   same editorial act (flip `status` in the vault → deploy) that the content
   gate already enforces.

## Architecture

```
~/Developer/vault/notes (source of truth; local-only)
      │  filekit frontmatter stage --where type=essay status=published
      ▼
staged/*.md
      │  Astro content loader (src/loaders/essays.ts)
      ▼
dist/  (static HTML + Pagefind index)   ← built on this machine
      │  scripts/deploy-pages.sh pushes dist/ to the orphan gh-pages branch
      ▼
gh-pages branch  →  GitHub Pages serves https://charlesponti.github.io/soapbox/
```

- Pages serves static files with no injected `Content-Security-Policy`, so
  Pagefind's WebAssembly search worker runs unmodified — no nginx, no CSP
  workaround, no container.
- `.nojekyll` is written into `dist/` at deploy time so Pages never runs
  Jekyll over the output (Jekyll would ignore underscore-prefixed dirs).
- The `404.html` at the output root is served by Pages for unknown paths.

## How to deploy

```bash
npm run deploy          # == bash scripts/deploy-pages.sh
```

`scripts/deploy-pages.sh`:

1. `npm run build` — runs the gates (astro check + typecheck), stages
   published essays from the vault, builds the static site, and runs Pagefind.
2. Pushes `dist/` to the orphan `gh-pages` branch (git worktree + rsync, so
   the working tree is never disturbed) and pushes the branch. Streaming
   output ends with the push; exit 0 = published.

To publish a new essay: flip `status: published` in the vault with
`filekit frontmatter set --file <vault-note> --field status --value published`,
then `npm run deploy`. That's the whole publishing act — the same gate that
governs local builds governs production.

One-time setup (already done): Pages source is the `gh-pages` branch, root
path. If it ever gets reset, re-point it under the repo's Settings → Pages.

## Verify a deploy

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://charlesponti.github.io/soapbox/                                   # 200
curl -s https://charlesponti.github.io/soapbox/essays/ | rg -o "From the notebook · [0-9]+"                        # essay count
curl -s -o /dev/null -w "%{http_code}\n" https://charlesponti.github.io/soapbox/pagefind/pagefind.js              # 200 → search live
curl -s -o /dev/null -w "%{http_code}\n" https://charlesponti.github.io/soapbox/voice-arch/                      # 200
```

## Rollback

Each deploy is one commit on `gh-pages`. To roll back, reset the branch to the
previous deploy commit and force-push it (or rebuild the previous state
locally and re-run `npm run deploy`). There is no data to lose: the vault is
the source of truth and is untouched by deploys.

## Operations & cost

- Zero servers, zero containers, zero cost beyond the repo itself.
- No logs worth watching; HTTP status is the health check.

## Gotchas

- **Every absolute link must be base-aware.** The site serves from
  `/soapbox/`, not `/`. Rule: depth-fixed pages use relative links
  (`essays/`, `../`, `assets/…`); shared layouts and components (used at any
  depth, including `404.html`) build URLs from `import.meta.env.BASE_URL`.
- **`astro preview` serves `dist/` at root.** Preview the production shape at
  `http://localhost:4321/soapbox/` after every rebuild.
- Dev (`npm run dev`) ignores the base and serves at root — relative links
  resolve identically there, so dev stays faithful.

## Future options (not done — deliberate)

- **Custom domain**: point DNS at GitHub Pages, drop a `CNAME` in `public/`,
  and remove `base:` from `astro.config.mjs` (absolute links would work again,
  but keep the relative-link rule — it survives both shapes).
- **Unpublish / private sections**: not supported by design. The publish gate
  is binary (`published` vs `draft`). Anything draft never ships.
- **Buckets for media**: if essays grow binary assets, prefer the repo's
  `public/` over external hosts so Pages serves them on the same origin.
