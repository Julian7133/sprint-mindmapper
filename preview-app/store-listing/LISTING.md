# Google Workspace Marketplace listing — AuraMindmap

Claim (shared with the Chrome Web Store listing): **Beautiful. Made for Google Drive™. Works with your agents & AI.**

Every feature below was checked against `preview-app/` on 2026-10-24. Do not add features that are not shipped.

## Application name (≤50 characters)

AuraMindmap

## Short description (≤200 characters)

Open markdown mind maps from Google Drive™ as a beautiful, interactive map. Pan, zoom, fold branches, and download HTML. Works with maps written by your agents & AI.

## Detailed description

AuraMindmap turns markdown outlines stored in Google Drive into a clear, interactive mind map. Right-click a `.md` file in Drive, choose **Open with → AuraMindmap**, and the outline opens as a map in your browser. Nothing to install for viewing.

**Beautiful**
- Full-screen, interactive mind map rendered from your headings and bullets
- Pan and zoom, expand and collapse branches
- The file name from Drive is shown as the map title

**Made for Google Drive™**
- Opens `.md` files directly from Drive via **Open with**
- Google access is limited to files you open with AuraMindmap or files it creates
- Your file is read in your browser; there is no AuraMindmap server that stores your content

**Works with your agents & AI**
- Maps are plain markdown outlines, so files written by AI assistants and coding agents open as mind maps without conversion
- Keep one source of truth: the same `.md` file stays readable as text and as a map

**Share and keep**
- Download a self-contained HTML version of the map
- **Edit in AuraMindmap** opens the current map as a local copy in the Chrome extension. Without the extension, it opens the Chrome Web Store listing

Google Drive is a trademark of Google LLC. AuraMindmap is not affiliated with or endorsed by Google.

## Single-purpose statement

AuraMindmap provides a read-only interactive preview of markdown mind map files stored in Google Drive. It is not a launcher-only app: users get pan/zoom navigation and export before any optional edit handoff.

## Category

Productivity (confirm the exact label in the Marketplace SDK category list).

## OAuth scope

| Scope | Purpose |
|---|---|
| `https://www.googleapis.com/auth/drive.file` | Read `.md` files the user opens with this app only |

## Search keywords

mind map, mindmap, markdown, markmap, outline, sprint planning, AI

## Graphic assets

| Asset | Required size | File |
|---|---|---|
| Application icons | 32×32, 48×48, 96×96, 128×128 | `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-96.png`, `icons/icon-128.png` (resized from `extension/icons/icon-256.png`) |
| Application card banner | 220×140 | `assets/banner-220x140.png` (source: `assets/banner-220x140.html`) |
| Screenshot 1 | 1280×800 | `screenshots/preview-1280x800.png`: real viewer UI with the neutral **Team Plan** sample map; Drive and Google sign-in were stubbed locally for the capture |
| Screenshot 2 (recommended) | 1280×800 | Not created: Drive's **Open with → AuraMindmap** menu. It can only be captured after the Drive integration is configured |

## Support & privacy

Verified in Chromium on 2026-10-24:

- Privacy policy: https://berlow.de/datenschutz — existing website policy; Julian must extend it for AuraMindmap Preview/Extension, Google Drive, hosting and local handoff copies before submission
- Support/contact: https://berlow.de/kontakt — existing general contact page; Julian must add AuraMindmap support guidance
- Imprint: https://berlow.de/impressum — existing page with contact information
- Terms of service: missing (`/nutzungsbedingungen` has no matching page); Julian must provide a suitable public HTTPS page
- Preview / Drive Open URL (planned deployment): https://aura.berlow.de/

No legal text was created in this dev round.
