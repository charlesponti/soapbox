#!/usr/bin/env bash
# Deploy the soapbox site (essays + decks) to GitHub Pages.
#
# Strategy: build locally and push dist/ to the orphan `gh-pages` branch,
# which Pages serves at https://charlesponti.github.io/soapbox/. The vault
# (~/Developer/vault/notes) is the source of truth and never leaves this
# machine; only rendered HTML + the Pagefind index are uploaded. Deploys are
# an explicit human-triggered command, never CI: CI never sees the vault, so
# a CI-built site would ship with zero essays.
#
# Usage: npm run deploy
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building locally (gates + stage + astro + pagefind)"
npm run build

echo "==> Publishing dist/ to the gh-pages branch"
TMP="$(mktemp -d)"
trap 'git worktree remove --force "$TMP" 2>/dev/null || true' EXIT
git fetch -q origin gh-pages 2>/dev/null || true
if git show-ref --verify --quiet refs/remotes/origin/gh-pages; then
  git worktree add -q -B gh-pages "$TMP" origin/gh-pages
else
  git worktree add -q --detach "$TMP"
  git -C "$TMP" checkout -q --orphan gh-pages
  git -C "$TMP" rm -q -rf .
fi
# .nojekyll: Pages must not run Jekyll over the output (it would ignore
# underscore-prefixed dirs).
touch dist/.nojekyll
rsync -a --delete --exclude '.git' dist/ "$TMP"/
git -C "$TMP" add -A
if git -C "$TMP" diff --cached --quiet; then
  echo "no changes to publish"
else
  git -C "$TMP" commit -q -m "deploy: soapbox $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git -C "$TMP" push origin gh-pages
fi
