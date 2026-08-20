#!/usr/bin/env bash
# Cut a Lion Wallet release: bump version, ad-hoc-sign a zip, tag, upload to
# GitHub Releases, and point the lsheva/homebrew-tap cask at it.
#
# Mirrors photo-viewer's Scripts/release.sh (Flash).

set -euo pipefail

APP_NAME="LionWallet"
APP_REPO="lsheva/lion-wallet"
TAP_REPO="lsheva/homebrew-tap"
CASK_TOKEN="lion-wallet"
PUBLISH_REMOTE="git@github-personal:lsheva/lion-wallet.git"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

die() { echo "error: $*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage:
  scripts/brew-release.sh <version> [--notes '...']
  scripts/brew-release.sh <version> --dry-run
  task brew-release -- 0.1.6
  task brew-release -- 0.1.6 --notes 'What changed.'

Needs macOS arm64, Xcode, gh (logged in as lsheva), and push access to
lsheva/lion-wallet and lsheva/homebrew-tap. Does not rewrite git history.
EOF
}

VERSION=""
NOTES=""
DRY=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --notes)
            [[ $# -ge 2 ]] || die "--notes needs a string"
            NOTES="$2"
            shift 2
            ;;
        --dry-run)
            DRY=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            die "unknown flag: $1"
            ;;
        *)
            [[ -z "$VERSION" ]] || die "unexpected argument: $1"
            VERSION="$1"
            shift
            ;;
    esac
done

[[ -n "$VERSION" ]] || die "usage: scripts/brew-release.sh <version> [--notes '...']"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version must look like 0.1.6, got '$VERSION'"
[[ "$(uname -s)" == Darwin ]] || die "releases are macOS-only"
[[ "$(uname -m)" == arm64 ]] || die "release zips are Apple Silicon (arm64) only"
command -v gh >/dev/null || die "gh is not on PATH"
command -v git >/dev/null || die "git is not on PATH"
command -v task >/dev/null || die "task is not on PATH"
gh auth status >/dev/null 2>&1 || die "gh is not logged in (gh auth status)"

git rev-parse --is-inside-work-tree >/dev/null
[[ -z "$(git status --porcelain)" ]] || die "working tree is dirty; commit or stash first"

if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    die "tag v$VERSION already exists"
fi
if gh release view "v$VERSION" --repo "$APP_REPO" >/dev/null 2>&1; then
    die "GitHub release v$VERSION already exists"
fi

TAG="v$VERSION"
ZIP="$ROOT/build/${APP_NAME}-${VERSION}.zip"
[[ -n "$NOTES" ]] || NOTES="Lion Wallet ${VERSION}"

echo "==> Release $TAG"

if [[ "$DRY" -eq 1 ]]; then
    echo "dry-run: would bump package.json, task dist, tag $TAG,"
    echo "         gh release create, and bump $TAP_REPO cask $CASK_TOKEN"
    exit 0
fi

# ------------------------------------------------------------------ bump ----

current="$(pnpm pkg get version | tr -d '"')"
if [[ "$current" != "$VERSION" ]]; then
    npm version "$VERSION" --no-git-tag-version --allow-same-version
fi

git add package.json
if git diff --cached --quiet; then
    die "package.json did not change (already at $VERSION?)"
fi
git commit -m "Release ${VERSION}."

echo "==> Pushing HEAD"
git remote remove publish 2>/dev/null || true
git remote add publish "$PUBLISH_REMOTE"
git push publish HEAD
git remote remove publish

# ------------------------------------------------------------------ build ---

echo "==> Building ad-hoc zip"
task dist
[[ -f "$ZIP" ]] || die "expected zip at $ZIP"
# build.ts rewrites this tracked file; keep the Release commit as the tag tip
git checkout -- bundle-sizes.txt
SHA="$(shasum -a 256 "$ZIP" | awk '{print $1}')"
echo "==> sha256  $SHA"

# ------------------------------------------------------------------ github --

echo "==> Tagging $TAG"
git tag -a "$TAG" -m "${APP_NAME} ${VERSION}"

echo "==> Pushing tag"
git remote remove publish 2>/dev/null || true
git remote add publish "$PUBLISH_REMOTE"
git push publish "$TAG"
git remote remove publish

echo "==> Uploading GitHub Release"
gh release create "$TAG" "$ZIP" \
    --repo "$APP_REPO" \
    --title "${APP_NAME} ${VERSION}" \
    --notes "$NOTES"

# ------------------------------------------------------------------ brew ----

echo "==> Updating Homebrew tap $TAP_REPO"
TAP="$(mktemp -d)"
trap 'rm -rf "$TAP"' EXIT
gh repo clone "$TAP_REPO" "$TAP" -- --depth 1
CASK="$TAP/Casks/${CASK_TOKEN}.rb"

if [[ -f "$CASK" ]]; then
    perl -pi -e "
        s/^  version \".*\"/  version \"${VERSION}\"/;
        s/^  sha256 \"[0-9a-f]+\"/  sha256 \"${SHA}\"/;
    " "$CASK"
else
    mkdir -p "$TAP/Casks"
    cat > "$CASK" <<RUBY
cask "${CASK_TOKEN}" do
  version "${VERSION}"
  sha256 "${SHA}"

  url "https://github.com/${APP_REPO}/releases/download/v#{version}/${APP_NAME}-#{version}.zip"
  name "Lion Wallet"
  desc "EVM wallet with native Keychain integration"
  homepage "https://github.com/${APP_REPO}"

  livecheck do
    url :homepage
    strategy :github_latest
  end

  depends_on macos: :sequoia
  depends_on arch: :arm64

  app "${APP_NAME}.app"

  # Not notarized. Strip Gatekeeper quarantine so a freshly downloaded
  # copy can launch; this is a local unsigned build, not an identified developer.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/${APP_NAME}.app"]
  end

  caveats <<~EOS
    Lion Wallet is ad-hoc signed (not notarized). Homebrew removes the
    quarantine flag after install. If macOS still blocks it, go to
    System Settings → Privacy & Security and click Open Anyway.

    Then enable the extension in Safari → Settings → Extensions, and
    allow unsigned extensions in Safari's Developer settings (this
    setting resets each time Safari relaunches).
  EOS
end
RUBY
fi

README="$TAP/README.md"
if [[ -f "$README" ]] && ! grep -q '`lion-wallet`' "$README"; then
    python3 - "$README" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
t = p.read_text()
old_row = "| `flash-viewer` | `Flash.app` | [lsheva/flash](https://github.com/lsheva/flash) |"
new_row = old_row + "\n| `lion-wallet` | `LionWallet.app` | [lsheva/lion-wallet](https://github.com/lsheva/lion-wallet) |"
if old_row in t:
    t = t.replace(old_row, new_row, 1)
t = t.replace(
    "brew install --cask flash-viewer\n",
    "brew install --cask flash-viewer\nbrew install --cask lion-wallet\n",
    1,
)
p.write_text(t)
PY
fi

EXISTING_CASK=0
if git -C "$TAP" cat-file -e "HEAD:Casks/${CASK_TOKEN}.rb" 2>/dev/null; then
    EXISTING_CASK=1
fi

git -C "$TAP" add "Casks/${CASK_TOKEN}.rb"
[[ -f "$README" ]] && git -C "$TAP" add README.md || true
git -C "$TAP" diff --cached --quiet && die "cask did not change"
if [[ "$EXISTING_CASK" -eq 1 ]]; then
    git -C "$TAP" commit -m "Point ${CASK_TOKEN} at the ${VERSION} release."
else
    git -C "$TAP" commit -m "Add ${CASK_TOKEN} cask at ${VERSION}."
fi
git -C "$TAP" push origin HEAD

echo
echo "Done."
echo "  Release: https://github.com/${APP_REPO}/releases/tag/${TAG}"
echo "  Cask:    brew tap lsheva/tap && brew install --cask ${CASK_TOKEN}"
echo "  sha256:  ${SHA}"
