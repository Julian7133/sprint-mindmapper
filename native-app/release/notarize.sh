#!/usr/bin/env bash
# Notarize + staple the AuraMindmap DMG with Apple's notary service.
#
# Requires (see release/.env.example):
#   export APPLE_ID=... APPLE_TEAM_ID=... APPLE_PASSWORD=...
#
# Usage:
#   ./release/notarize.sh                     # uses the built DMG
#   ./release/notarize.sh /path/to/AuraMindmap.dmg
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." # native-app root

: "${APPLE_ID:?set APPLE_ID in env}"
: "${APPLE_TEAM_ID:?set APPLE_TEAM_ID in env}"
: "${APPLE_PASSWORD:?set APPLE_PASSWORD (app-specific password) in env}"

DMG="${1:-$(ls src-tauri/target/release/bundle/dmg/AuraMindmap*.dmg 2>/dev/null | head -1 || true)}"
if [[ -z "$DMG" || ! -f "$DMG" ]]; then
  echo "DMG not found. Run ./release/release.sh first (or pass a path)." >&2
  exit 1
fi

echo "Submitting $DMG to notary service…"
xcrun notarytool submit "$DMG" --wait \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_PASSWORD"

echo "Stapling ticket…"
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"

echo "Notarized + stapled: $DMG"
