#!/usr/bin/env bash
# Deploy the soapbox site (essays + decks) to Railway.
# (Railway project/service are still named "lexicon"/"web".)
#
# Strategy: build locally, push only the built artifacts. The vault
# (~/Developer/vault/notes) is the source of truth and NEVER leaves this
# machine; this script runs the full local build (gates + filekit stage +
# astro build + pagefind) and uploads the repo root to the Railway "web"
# service, where the Dockerfile (nginx) serves dist/. nginx replaces Railway's
# built-in static server because its injected CSP lacks 'wasm-unsafe-eval',
# which breaks Pagefind search. No git remote is involved.
#
# Usage: npm run deploy   (or: bash scripts/deploy.sh)
set -euo pipefail

PROJECT_ID="00c33d81-ff48-46e8-8e60-2c567591a338"
ENVIRONMENT_ID="04e91d46-2792-4302-802b-0684da92f314"
SERVICE_ID="188a939e-0674-4299-a4dc-841249921755"

cd "$(dirname "$0")/.."

echo "==> Building locally (gates + stage + astro + pagefind)"
npm run build

echo "==> Uploading to Railway (service: web, Dockerfile/nginx build)"
# --no-gitignore includes dist/ (gitignored) so the Dockerfile can COPY it;
# .railwayignore still trims the heavy/generated dirs. Note: pass NO explicit
# path — `railway up .` fails with "prefix not found"; the no-arg form uploads
# the current directory. Streaming up: exit 0 = deployed, exit 1 = failed.
# Vault and git stay local.
railway up \
  --no-gitignore \
  --project "$PROJECT_ID" \
  --environment "$ENVIRONMENT_ID" \
  --service "$SERVICE_ID" \
  -m "deploy: soapbox $(date -u +%Y-%m-%dT%H:%M:%SZ)"