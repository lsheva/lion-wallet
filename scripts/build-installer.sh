#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

VERSION=$(node -p "require('./package.json').version")
PACKAGE_ONLY=false
APP_DIR=""

for arg in "$@"; do
  case "$arg" in
    --package-only) PACKAGE_ONLY=true ;;
    --app-dir=*) APP_DIR="${arg#--app-dir=}" ;;
  esac
done

if [ "$PACKAGE_ONLY" = false ]; then
  echo "==> Building Safari app..."
  pnpm build:safari

  echo "==> Building Chrome extension..."
  pnpm build:chrome:ext

  APP_DIR="${APP_DIR:-build/safari/Build/Products/Debug/LionWallet.app}"
else
  if [ -z "$APP_DIR" ]; then
    echo "Error: --package-only requires --app-dir=<path>"
    exit 1
  fi
fi

echo "==> Embedding Chrome assets in app bundle..."
cp build/lion-wallet-chrome-"${VERSION}".zip \
   "$APP_DIR/Contents/Resources/lion-wallet-chrome.zip"
cp installer/postinstall \
   "$APP_DIR/Contents/Resources/.install-chrome-host.sh"

# --- PKG ---

PKG_ROOT="build/pkg-root"
FINAL_PKG="build/LionWallet-${VERSION}.pkg"
COMPONENT_PKG="build/LionWallet-component.pkg"

echo "==> Preparing pkg root..."
rm -rf "$PKG_ROOT"
mkdir -p "$PKG_ROOT/Applications"
cp -R "$APP_DIR" "$PKG_ROOT/Applications/LionWallet.app"

echo "==> Building component pkg..."
pkgbuild \
  --root "$PKG_ROOT" \
  --identifier app.lionwallet.pkg \
  --version "$VERSION" \
  --scripts installer \
  "$COMPONENT_PKG"

echo "==> Building final pkg..."
productbuild \
  --distribution installer/distribution.xml \
  --resources installer \
  --package-path build \
  "$FINAL_PKG"

rm -f "$COMPONENT_PKG"
rm -rf "$PKG_ROOT"

echo "PKG ready: $FINAL_PKG"

# --- DMG ---

DMG_STAGE="build/dmg-stage"
FINAL_DMG="build/LionWallet-${VERSION}.dmg"

echo "==> Building DMG..."
rm -rf "$DMG_STAGE" "$FINAL_DMG"
mkdir -p "$DMG_STAGE"

cp -R "$APP_DIR" "$DMG_STAGE/LionWallet.app"
cp build/lion-wallet-chrome-"${VERSION}".zip "$DMG_STAGE/Chrome Extension.zip"
ln -s /Applications "$DMG_STAGE/Applications"
cp installer/README.rtf "$DMG_STAGE/README — Chrome Setup.rtf"
cp installer/postinstall "$DMG_STAGE/.install-chrome-host.sh"

if command -v osacompile &>/dev/null; then
  osacompile -o "$DMG_STAGE/Open Chrome Extensions.app" -e \
    'do shell script "open -a \"Google Chrome\" \"chrome://extensions\""'
fi

hdiutil create \
  -volname "LionWallet ${VERSION}" \
  -srcfolder "$DMG_STAGE" \
  -ov \
  -format UDZO \
  "$FINAL_DMG"

rm -rf "$DMG_STAGE"

echo "DMG ready: $FINAL_DMG"
