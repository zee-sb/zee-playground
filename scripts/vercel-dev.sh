#!/usr/bin/env bash
# Wrapper for `vercel dev` that explicitly loads .env.local into the shell
# before exec'ing vercel — works around vercel dev sometimes failing to inject
# cloud env vars into the function runtime when launched via process managers.
set -e
cd "$(dirname "$0")/.."
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . .env.local
  set +a
fi
exec /opt/homebrew/bin/vercel dev --listen 3000 --yes
