#!/usr/bin/env bash
# Build the AuraMindmap .app + .dmg for macOS (signing + notarization optional).
#
# Required only for a signed/notarized release:
#   export APPLE_ID=... APPLE_TEAM_ID=... APPLE_PASSWORD=...   (see release/.env.example)
#   export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
#
# Usage:
#   ./release/release.sh                 # host arch
#   ./release/release.sh universal-apple-darwin
#   ./release/release.sh aarch64-apple-darwin
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." # native-app root

TARGET="${1:-}"

OVERRIDE=""
if [[ -n "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  OVERRIDE="$(mktemp)"
  trap 'rm -f "$OVERRIDE"' EXIT
  cat > "$OVERRIDE" <<JSON
{ "bundle": { "macOS": { "signingIdentity": "$APPLE_SIGNING_IDENTITY" } } }
JSON
  echo "Signing identity: $APPLE_SIGNING_IDENTITY"
fi

npm run build

ARGS=(--bundles app,dmg)
[[ -n "$TARGET" ]] && ARGS+=(--target "$TARGET")
[[ -n "$OVERRIDE" ]] && ARGS+=(--config "$OVERRIDE")

npx tauri build "${ARGS[@]}"

APP_BUNDLE="$(ls -d src-tauri/target/release/bundle/macos/AuraMindmap.app 2>/dev/null || true)"
DMG="$(ls src-tauri/target/release/bundle/dmg/AuraMindmap*.dmg 2>/dev/null | head -1 || true)"

echo
echo "Built .app: $APP_BUNDLE"
echo "Built .dmg: $DMG"
echo
echo "Next: sign + notarize -> APPLE_ID=... ./release/notarize.sh \"$DMG\""
