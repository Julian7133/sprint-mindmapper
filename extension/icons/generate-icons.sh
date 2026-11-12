#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETPLACE_DIR="$DIR/../../preview-app/store-listing/icons"
SOURCE="$DIR/icon.svg"

# Render all sizes from the same vector, including the store's transparent margin.
if command -v rsvg-convert >/dev/null 2>&1; then
  render() { rsvg-convert -w "$1" -h "$1" "$SOURCE" -o "$2"; }
elif command -v magick >/dev/null 2>&1; then
  render() { magick -background none -density 384 "$SOURCE" -resize "$1x$1" "PNG32:$2"; }
elif command -v sips >/dev/null 2>&1; then
  render() { sips -s format png -z "$1" "$1" "$SOURCE" --out "$2" >/dev/null; }
else
  echo "Install rsvg-convert or ImageMagick, or use sips on macOS, to rasterize $SOURCE." >&2
  exit 1
fi

mkdir -p "$MARKETPLACE_DIR"
for size in 16 48 128 256; do
  render "$size" "$DIR/icon-$size.png"
done
for size in 32 48 96 128; do
  render "$size" "$MARKETPLACE_DIR/icon-$size.png"
done

echo "Generated extension and Marketplace icons from $SOURCE"
