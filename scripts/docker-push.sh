#!/usr/bin/env bash
# Baut das Image für Raspberry Pi (arm64) und x86 (amd64) und veröffentlicht es auf ghcr.io.
# Usage: npm run docker:push
set -euo pipefail

IMAGE="ghcr.io/luka-lta/druckwunsch/druckwunsch"
VERSION="$(node -p "require('./package.json').version")"

docker buildx build \
  --platform linux/arm64,linux/amd64 \
  --tag "$IMAGE:latest" \
  --tag "$IMAGE:$VERSION" \
  --push \
  .

echo "✓ Veröffentlicht: $IMAGE:latest und $IMAGE:$VERSION"
