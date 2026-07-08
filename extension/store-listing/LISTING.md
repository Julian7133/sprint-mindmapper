# Chrome Web Store listing — AuraMindmap

## Title

AuraMindmap — Sprint Mind Map Editor

## Short description (≤132 characters)

Edit sprint mind maps as markdown files on your computer. Optional Google Drive sync. Works offline.

## Detailed description

AuraMindmap is a full-screen mind map editor built for agile sprint planning. Organize epics, stories, and tasks on an infinite canvas with priorities, markers, and keyboard shortcuts — then save everything as plain markdown you own.

**Features**
- Open a local folder of `.md` mindmaps (File System Access API)
- MindElixir canvas: drag, edit, expand/collapse, priority hotkeys (1–5)
- XMind-style markers and paste-from-outline support
- Export PNG, SVG, and self-contained markmap HTML previews
- Optional Google Drive sync to an app-specific folder (`drive.file` scope)
- Side panel for quick capture alongside your browser tabs
- Works offline — all code is bundled, no remote scripts

**Who it's for**
Developers, product owners, and teams who plan sprints as hierarchical mind maps and want files that work in git, Obsidian, or any text editor.

## Single-purpose statement

AuraMindmap has one purpose: editing and organizing sprint mind maps stored as markdown files on the user's device (with optional backup to Google Drive).

## Category

Productivity

## Permissions justification

| Permission | Justification |
|---|---|
| `storage` | Persist drafts, recent files, folder reconnect metadata, and Drive sync file mapping locally |
| `sidePanel` | Show a compact companion editor in Chrome's side panel |
| `windows` | Open the full editor in a dedicated popup window (1280×800) |
| `identity` (optional) | Only requested when the user clicks "Enable Drive sync"; used for OAuth to upload `.md` files to a dedicated Drive folder |

No `tabs`, `host_permissions`, or broad file access permissions are requested.

## Assets checklist

- [ ] 1280×800 screenshot (editor with mind map) — open `screenshots/screenshot-template.html` in Chrome and capture, or use a live editor session (see `screenshots/README.md`)
- [ ] 440×280 small promo tile
- [x] 16 / 48 / 128 / 256 px icons in `extension/icons/`
- [x] 256 px icon in `manifest.json` icons block
- [ ] Privacy policy URL (host `PRIVACY-POLICY.md` on Netlify/GitHub Pages)
- [ ] Replace `REPLACE_WITH_OAUTH_CLIENT_ID` in `manifest.json` before release with Drive sync enabled

## Support URL / homepage

TBD — project repository or product site.
