#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

if [[ -z "${API_KEY:-}" ]]; then
  echo "API_KEY is required"
  exit 1
fi

exec /opt/homebrew/bin/node \
  "$SCRIPT_DIR/test-api-key-access.mjs" \
  "base=$BASE_URL" \
  "apiKey=$API_KEY"
