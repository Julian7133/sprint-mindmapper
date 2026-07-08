#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIZES=(16 48 128)

generate_with_imagemagick() {
  local convert_cmd="$1"
  for size in "${SIZES[@]}"; do
    "$convert_cmd" -size "${size}x${size}" \
      "gradient:#3949ab-#5e35b1" \
      -gravity center \
      -fill white \
      -font Helvetica-Bold \
      -pointsize "$((size * 5 / 8))" \
      -annotate 0 "A" \
      "$DIR/icon-${size}.png"
  done
}

generate_with_python() {
  python3 - "$DIR" "${SIZES[@]}" <<'PY'
import struct
import sys
import zlib
from pathlib import Path

out_dir = Path(sys.argv[1])
sizes = [int(s) for s in sys.argv[2:]]

TOP = (0x39, 0x49, 0xAB)
BOTTOM = (0x5E, 0x35, 0xB1)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def write_png(path, width, height, rgba_rows):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + row for row in rgba_rows)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def draw_a(size):
    rows = []
    cx = (size - 1) / 2
    cy = (size - 1) / 2
    stroke = max(1, size // 8)
    for y in range(size):
        row = bytearray(size * 4)
        t = y / max(size - 1, 1)
        r = lerp(TOP[0], BOTTOM[0], t)
        g = lerp(TOP[1], BOTTOM[1], t)
        b = lerp(BOTTOM[2], BOTTOM[2], t)
        b = lerp(TOP[2], BOTTOM[2], t)
        for x in range(size):
            idx = x * 4
            row[idx:idx + 3] = bytes((r, g, b))
            row[idx + 3] = 255

            nx = (x - cx) / max(size / 2, 1)
            ny = (y - cy) / max(size / 2, 1)

            left_leg = abs(nx + ny * 0.55) < stroke / max(size / 2, 1)
            right_leg = abs(nx - ny * 0.55) < stroke / max(size / 2, 1)
            crossbar = abs(ny + 0.05) < stroke / max(size / 2, 1) and -0.15 <= nx <= 0.15

            if (left_leg or right_leg or crossbar) and -0.75 <= ny <= 0.85:
                row[idx:idx + 3] = b"\xff\xff\xff"
        rows.append(bytes(row))
    return rows


for size in sizes:
    write_png(out_dir / f"icon-{size}.png", size, size, draw_a(size))
PY
}

if command -v magick >/dev/null 2>&1; then
  generate_with_imagemagick magick
elif command -v convert >/dev/null 2>&1; then
  generate_with_imagemagick convert
elif command -v python3 >/dev/null 2>&1; then
  generate_with_python
else
  cat > "$DIR/icon.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3949ab"/>
      <stop offset="100%" stop-color="#5e35b1"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" fill="url(#bg)"/>
  <text x="64" y="92" text-anchor="middle" fill="#fff" font-family="Helvetica, Arial, sans-serif" font-size="72" font-weight="700">A</text>
</svg>
SVG
  echo "TODO: Install ImageMagick or Python 3 to generate icon-16.png, icon-48.png, and icon-128.png."
  echo "SVG fallback written to $DIR/icon.svg"
  exit 0
fi

echo "Generated PNG icons in $DIR"
