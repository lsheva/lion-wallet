#!/bin/bash
set -euo pipefail

HOST_NAME="app.lionwallet"
MANIFEST_PATH="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/$HOST_NAME.json"

if [ -f "$MANIFEST_PATH" ]; then
    rm "$MANIFEST_PATH"
    echo "Removed native messaging host manifest:"
    echo "  $MANIFEST_PATH"
else
    echo "No manifest found at:"
    echo "  $MANIFEST_PATH"
fi
