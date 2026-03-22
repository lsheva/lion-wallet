#!/bin/bash
set -euo pipefail

HOST_NAME="app.lionwallet"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/$HOST_NAME.json"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_BINARY="$PROJECT_DIR/build/safari/Build/Products/Debug/LionWallet.app/Contents/MacOS/LionWallet"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <chrome-extension-id>"
    echo ""
    echo "Find the extension ID in chrome://extensions after loading the unpacked extension."
    echo "Example: $0 abcdefghijklmnopqrstuvwxyzabcdef"
    exit 1
fi

EXTENSION_ID="$1"

if [ ! -f "$APP_BINARY" ]; then
    echo "Error: LionWallet.app not found at:"
    echo "  $APP_BINARY"
    echo ""
    echo "Run 'pnpm build:safari' first to build the app."
    exit 1
fi

mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_PATH" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Lion Wallet — Keychain bridge for Chrome",
  "path": "$APP_BINARY",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
EOF

echo "Installed native messaging host manifest:"
echo "  $MANIFEST_PATH"
echo ""
echo "Host binary: $APP_BINARY"
echo "Extension ID: $EXTENSION_ID"
echo ""
echo "Restart Chrome for the change to take effect."
