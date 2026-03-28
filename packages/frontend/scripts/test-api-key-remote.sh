#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-https://eve-eyes.d0v.xyz}"

export https_proxy="${https_proxy:-http://127.0.0.1:7890}"
export http_proxy="${http_proxy:-http://127.0.0.1:7890}"
export all_proxy="${all_proxy:-socks5://127.0.0.1:7890}"

if [[ -z "${API_KEY:-}" ]]; then
  echo "API_KEY is required"
  exit 1
fi

exec /opt/homebrew/bin/node \
  "$SCRIPT_DIR/test-api-key-access.mjs" \
  "base=$BASE_URL" \
  "apiKey=$API_KEY"
