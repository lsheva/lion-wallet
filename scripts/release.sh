#!/bin/sh
set -e

BUMP="$1"

if [ "$BUMP" != "patch" ] && [ "$BUMP" != "minor" ] && [ "$BUMP" != "major" ]; then
  echo "Usage: scripts/release.sh [patch|minor|major]"
  exit 1
fi

npm version "$BUMP" --no-git-tag-version
VERSION=$(pnpm pkg get version | tr -d '"')

git add package.json
git commit -m "release: v${VERSION}"
git tag "v${VERSION}"

echo "Tagged v${VERSION}"
