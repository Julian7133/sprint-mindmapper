#!/usr/bin/env bash
set -euo pipefail

# Render a heading-based markdown outline (markmap / mindmapai.app style)
# into an interactive HTML mindmap, plus a PNG screenshot.
#
# Usage: ./render-markmap.sh [input.md] [output-basename]
#   Defaults: input = sprint-tasks.md, output basename = input without .md
#
# Note: INPUT / BASENAME may be absolute (the editor server passes an absolute
# markdown path). The file:// URL below is therefore derived from the resolved
# output path rather than re-prefixing $(pwd), which previously produced a
# doubled path (file://<cwd>/<abs>.html) and a broken "file not found" PNG.

INPUT="${1:-sprint-tasks.md}"
BASENAME="${2:-${INPUT%.md}}"

cd "$(dirname "$0")"

HTML_OUT="${BASENAME}.html"
PNG_OUT="${BASENAME}.png"

# 1) Interactive, self-contained HTML (open in any browser: drag / zoom / collapse)
npx -y markmap-cli@latest "$INPUT" -o "$HTML_OUT" --no-open

# Resolve an absolute path for the file:// URL (BASENAME may be absolute or relative).
case "$HTML_OUT" in
  /*) HTML_ABS="$HTML_OUT" ;;
  *)  HTML_ABS="$(pwd)/$HTML_OUT" ;;
esac

# 2) PNG screenshot via headless Chrome (best-effort).
# --virtual-time-budget gives markmap time to load its CDN scripts and finish the
# initial fit()/transition before the frame is captured; without it the map is
# caught mid-animation, squeezed into the top-left corner, or blank.
# NB: classic --headless is required here — the new headless mode (--headless=new)
# captures a blank frame under --virtual-time-budget for this CDN-driven page.
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then
  "$CHROME" --headless --disable-gpu \
    --screenshot="$PNG_OUT" \
    --window-size=2000,1300 \
    --default-background-color=FFFFFFFF \
    --hide-scrollbars \
    --virtual-time-budget=20000 \
    "file://$HTML_ABS" >/dev/null 2>&1 || true
  echo "Rendered: $HTML_OUT and $PNG_OUT"
else
  echo "Rendered: $HTML_OUT (Chrome not found, skipped PNG)"
fi
