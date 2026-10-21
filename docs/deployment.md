# DEPLOY — soapbox deployment strategy (essays + decks)

Lexicon (the studio's core knowledge site) is a fully static Astro site that is
**built locally and pushed to Railway**. This page documents the strategy: the
threat model it satisfies, the mechanism, and the operational procedures.

## Decisions (locked)

| Decision | Choice                 | Why                                                                                       |
| -------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| Access   | **Public internet**    | The site is the studio's public knowledge surface                                         |
| Host     | **Railway**            | Existing studio infra (hominem) lives there; free static serving, custom domains, HTTPS   |
| Build    | **Local build + push** | The vault (`~/Developer/vault/notes`) is the source of truth and never leaves the machine |

The two hard constraints that drive everything:

1. **The vault never leaves this machine.** It has no git remote and never gets
   one. Only built, static pages (rendered HTML + Pagefind index) are uploaded.
2. **No CI / no git remote for the site repo.** Deploys are an explicit,
   human-triggered local command. This is a feature: publishing requires the
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
      │  railway up --no-gitignore   (uploads repo root; Dockerfile builds image)
      ▼
Railway project "lexicon" → service "web" (nginx:alpine serving dist/)
      │
      ▼
https://web-production-02a47.up.railway.app   (public, HTTPS)
```

- **The site runs under nginx, not Railway's built-in static server.** Railway's
  static hosting injects a `Content-Security-Policy` header without
  `wasm-unsafe-eval`, which blocks Pagefind's WebAssembly search worker
  (`CompileError` on every page load). The `Dockerfile` + `nginx.conf` replace
  that server so we control the CSP (added `wasm-unsafe-eval`) plus cache
  headers. Railway's infra CSP is not overridable from headers or meta tags.
- The vault and `staged/` never enter the upload; `--no-gitignore` is needed so
  the Dockerfile's `COPY dist` sees the gitignored build output, and
  `.railwayignore` trims the rest of the upload.
- Railway object-storage buckets were considered but rejected: **buckets are
  private-only** (presigned URLs / proxying only; public buckets unsupported as
  of Aug 2026), so a containerized static _service_ is the right primitive for
  a public site.

## How to deploy

```bash
npm run deploy          # == bash scripts/deploy.sh
```

`scripts/deploy.sh`:

1. `npm run build` — runs the gates (astro check + typecheck), stages
   published essays from the vault, builds the static site, and runs Pagefind.
2. `railway up --no-gitignore --project <id> --environment <id> --service <id>`
   — uploads the repo root and builds the `Dockerfile` (nginx) on Railway.
   Streaming `up` exits 0 only on a successful deploy.

Railway project/service IDs are pinned in `scripts/deploy.sh` (they are not
secrets). To publish a new essay: flip `status: published` in the vault with
`filekit frontmatter set`, then `npm run deploy`. That's the whole publishing
act — the same gate that governs local builds governs production.

Two footguns worth knowing:

- **Do not pass an explicit path to `railway up`** (`railway up .` fails with
  "prefix not found"); the no-arg form uploads the current directory.
- The service domain is pinned to **target port 80** (nginx). It was set with
  `railway domain update web-production-02a47.up.railway.app --port 80`; if the
  domain is ever recreated, re-apply it or traffic 502s.

## Verify a deploy

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://web-production-02a47.up.railway.app/            # 200
curl -s https://web-production-02a47.up.railway.app/essays/<slug>/ | rg -o "<title>[^<]*</title>"
curl -s -o /dev/null -w "%{http_code}\n" https://web-production-02a47.up.railway.app/pagefind/pagefind.js  # 200 → search live
curl -sI https://web-production-02a47.up.railway.app/ | rg "wasm-unsafe-eval"                        # CSP allows WASM
```

Deployment status: `railway deployment list --project <id> --environment <id>
--service <id> --json`. Only report success after the newest deployment shows
`SUCCESS`.

## Rollback

Each deploy is an immutable upload; the previous `dist/` is replaced in place.
To roll back to a previous build:

1. Rebuild the previous state locally (check out the commit / re-stage) and
   re-run `npm run deploy`. Since content is the only thing that changes, this
   is equivalent to unpublishing/republishing.
2. Or use Railway's dashboard: open the `web` service → Deployments → Redeploy
   an earlier successful deployment (recreates that artifact).

There is no data to lose: the vault is the source of truth and is untouched by
deploys.

## Operations & cost

- One `nginx:alpine` container serving ~3 MB `dist/`. Cost is the container's
  usage (a single tiny replica; negligible).
- No logs worth watching; HTTP status is the health check.
- Railway sleeps containers on idle by default; nginx is stateless and
  wake-on-request, so sleep is harmless. If sleep is disabled, the service
  idles at a small flat cost — see service settings.

## Future options (not done — deliberate)

- **Custom domain**: attach a studio domain to the `web` service (Railway →
  service → Settings → Networking → custom domain, keep target port 80).
  Update `astro.config.mjs` `site:` when you do (affects canonical URLs /
  sitemap).
- **Unpublish / private sections**: not supported by design. The publish gate
  is binary (`published` vs `draft`). Anything draft never ships.
- **Buckets for media**: if essays grow binary assets, Railway buckets + signed
  URLs is the supported pattern (buckets stay private).
