#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "==> Building Chrome extension..."
pnpm build:chrome:ext

echo "==> Closing any running Chrome (required for --load-extension)..."
osascript -e 'quit app "Google Chrome"' 2>/dev/null || true
# Wait for Chrome to fully exit before relaunching
while pgrep -x "Google Chrome" > /dev/null 2>&1; do
  sleep 0.5
done

echo "==> Launching Chrome with Lion Wallet loaded..."
open -a "Google Chrome" --args --load-extension="$(pwd)/build/chrome" --enable-logging=stderr

echo "Chrome launched. Open chrome://extensions to verify Lion Wallet is loaded."
