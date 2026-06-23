#!/usr/bin/env bash
set -euo pipefail

# Render a heading-based markdown outline (markmap / mindmapai.app style)
# into an interactive HTML mindmap, plus a PNG screenshot.
#
# Usage: ./render-markmap.sh [input.md] [output-basename]
#   Defaults: input = sprint-tasks.md, output basename = input without .md

INPUT="${1:-sprint-tasks.md}"
BASENAME="${2:-${INPUT%.md}}"

cd "$(dirname "$0")"

# 1) Interactive, self-contained HTML (open in any browser: drag / zoom / collapse)
npx -y markmap-cli@latest "$INPUT" -o "${BASENAME}.html" --no-open

# 2) PNG screenshot via headless Chrome (best-effort)
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then
  "$CHROME" --headless --disable-gpu \
    --screenshot="${BASENAME}.png" \
    --window-size=2000,1300 \
    --default-background-color=FFFFFFFF \
    --hide-scrollbars \
    "file://$(pwd)/${BASENAME}.html" >/dev/null 2>&1 || true
  echo "Rendered: ${BASENAME}.html and ${BASENAME}.png"
else
  echo "Rendered: ${BASENAME}.html (Chrome not found, skipped PNG)"
fi
