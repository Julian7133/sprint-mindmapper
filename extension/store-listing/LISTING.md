# Chrome Web Store listing — AuraMindmap

Claim (shared with the Workspace Marketplace listing): **Beautiful. Made for Google Drive™. Works with your agents & AI.**

Reviewed on 2026-10-24. Import is browser-bundled and tested; Drive upload endpoint is corrected. A real Google Drive upload/update smoke test remains a pre-launch Julian step (see the launch checklist).

## Title

AuraMindmap

The store title is the manifest `name` (`extension/manifest.json:3`, max. 75 characters).

## Summary (≤132 characters)

Beautiful mind maps saved as plain markdown. Made for Google Drive™. Works with your agents & AI. Offline, no account.

The summary is the manifest `description` (`extension/manifest.json:5`); it is kept identical to this line.

## Detailed description

AuraMindmap is a calm, full-screen mind map editor that saves every map as a plain markdown file. Plan projects, sprints, and ideas on a visual canvas, and keep files you own: readable in any text editor, easy to see what changed, and easy to hand to an AI assistant.

**Beautiful**
- Full-screen canvas: drag, edit, expand and collapse branches
- XMind-style markers: priority 1–7, task progress, flags, stars, and people
- Keyboard first: start typing to edit a topic, set priorities with Ctrl+1–7 (Cmd+1–7 on Mac), focus on one branch with F6
- Open several maps in tabs, link topics to other maps in your folder, and see which maps link here

**Made for Google Drive™**
- Optional Drive sync: save a copy of the current map in an "AuraMindmap" folder in your Google Drive
- Google access is limited to files you open with AuraMindmap or files it creates
- Drive sync is off by default; Google sign-in is requested only when you turn it on

**Works with your agents & AI**
- Every map is a readable markdown outline of headings and bullets
- AI assistants and coding agents can read, write, and update your maps directly, with no plugin and no API key
- Let an assistant draft a plan as markdown, save it to your folder, and open it as a mind map
- Import XMind (.xmind), FreeMind (.mm), and OPML files

**Your files, offline**
- Works with a folder on your computer; drafts are kept locally until you save
- Saving also writes an interactive HTML version of the map next to the markdown file
- Export PNG or SVG
- Paste outlines from anywhere: as siblings, as a child outline, or as one topic
- Fully offline: all code is bundled in the extension, no account, no analytics
- Open it from the toolbar, with Ctrl+Shift+M (Cmd+Shift+M on Mac), or in Chrome's side panel

Google Drive is a trademark of Google LLC. AuraMindmap is not affiliated with or endorsed by Google.

## Single-purpose statement

AuraMindmap has one purpose: creating and editing mind maps stored as markdown files on the user's device, with an optional copy to the user's Google Drive.

## Category

Productivity › Workflow & Planning (pick from the dashboard's category list; fall back to the closest Productivity subcategory if the label differs).

## Language

English

## Permissions justification

| Permission | Justification |
|---|---|
| `storage` | Persist drafts, recent files, folder reconnect metadata, and Drive sync file mapping locally |
| `sidePanel` | Show a compact companion editor in Chrome's side panel |
| `identity` (optional) | Only requested when the user clicks "Enable Drive sync…"; used for OAuth to upload `.md` files to a dedicated Drive folder |

No `tabs`, `host_permissions`, or broad file access permissions are requested.

## Assets checklist

- [x] 1280×800 screenshot: `screenshots/editor-1280x800.png` (real editor, neutral sample map, no alpha)
- [x] 440×280 small promo tile (optional): `promo/promo-440x280.png` (source: `promo/promo-440x280.html`)
- [x] 16 / 48 / 128 / 256 px icons in `extension/icons/` (see icon note in the launch checklist)
- [ ] Privacy policy URL: https://berlow.de/datenschutz — Julian must extend the existing website policy for AuraMindmap before submission
- [ ] Replace `REPLACE_WITH_OAUTH_CLIENT_ID` in `extension/manifest.json:21` with the Chrome-extension OAuth client

## Support URL / homepage

Homepage (planned deployment): https://aura.berlow.de

Support/contact: https://berlow.de/kontakt · Imprint: https://berlow.de/impressum

Privacy policy: https://berlow.de/datenschutz exists, but Julian must extend it for AuraMindmap (Preview, Extension, Google Drive and local handoff copies) before submission. Terms of service are still missing. Contact pages were verified in Chromium on 2026-10-24; no product-specific support page was found.
