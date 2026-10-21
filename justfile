# Studio standard interface: up / dev / check.
# Recipe names are identical in every repo; bodies delegate to this repo's
# native scripts (npm — see README). No test runner configured yet, so no
# `test` recipe (tests/search-check.mjs is a manual script).

default:
    @just --list

up:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ "$(curl -k -s -o /dev/null -w '%{http_code}' -m 3 https://localhost:4200/)" = "000" ]; then
      echo "starting portless proxy..."
      npm exec portless proxy start -p 4200 --tld lvh.me
    else
      echo "proxy already up on :4200"
    fi
    echo "soapbox: https://soapbox.lvh.me:4200"

# Stage essays, then astro dev through the portless proxy.
dev:
    npm run dev

check:
    npm run gates
