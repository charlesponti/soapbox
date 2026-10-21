# Testing — soapbox (essays + decks)

How the repo verifies behavior. The fast gates run automatically; the heavy
integration gate needs a running preview server and stays manual.

## Fast gates (`npm run gates`)

`pnpm check && pnpm typecheck`. Runs automatically as `prebuild` before every
`pnpm build` and via the tracked `.githooks/pre-commit` hook (installed by
`pnpm prepare` / `scripts/install-hooks.mjs`).

- `pnpm exec astro check`; expects 0 errors, 0 warnings.
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm lint` — `oxlint --fix` (Rust-based; fast).

## Integration gate

`tests/search-check.mjs` — 15 assertions covering Pagefind search, facets,
pagination, and view-transition navigation against a real build. Needs a
preview server up:

```bash
npm run build && npm run preview &   # preview serves dist/ :4321
node tests/search-check.mjs          # 15/15 must pass
```

`astro preview` serves stale `dist/` — restart it after every rebuild before
re-running the gate.

## Deploy verification

After `npm run deploy`, verify the live site (see `docs/deployment.md`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://web-production-02a47.up.railway.app/
curl -s -o /dev/null -w "%{http_code}\n" https://web-production-02a47.up.railway.app/pagefind/pagefind.js
curl -sI https://web-production-02a47.up.railway.app/ | rg "wasm-unsafe-eval"
```
