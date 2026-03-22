#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PEM_FILE="$PROJECT_DIR/chrome-extension.pem"
MANIFEST="$PROJECT_DIR/src/manifest.chrome.json"
POSTINSTALL="$PROJECT_DIR/installer/postinstall"

if [ -f "$PEM_FILE" ]; then
    echo "Using existing key: $PEM_FILE"
else
    echo "Generating new key..."
    openssl genrsa 2048 2>/dev/null | openssl pkcs8 -topk8 -nocrypt -out "$PEM_FILE" 2>/dev/null
    echo "Created: $PEM_FILE"
fi

MANIFEST_KEY=$(openssl rsa -in "$PEM_FILE" -pubout -outform DER 2>/dev/null | openssl base64 -A)
EXTENSION_ID=$(openssl rsa -in "$PEM_FILE" -pubout -outform DER 2>/dev/null | shasum -a 256 | head -c32 | tr 0-9a-f a-p)

echo "Extension ID: $EXTENSION_ID"
echo "Public key:   ${MANIFEST_KEY:0:40}..."

node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('$MANIFEST', 'utf8'));
manifest.key = '$MANIFEST_KEY';
fs.writeFileSync('$MANIFEST', JSON.stringify(manifest, null, 2) + '\n');
console.log('Updated: $MANIFEST');
"

sed -i '' "s/^EXTENSION_ID=.*/EXTENSION_ID=\"$EXTENSION_ID\"/" "$POSTINSTALL"
echo "Updated: $POSTINSTALL"
