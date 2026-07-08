# Chrome Web Store submission checklist

## Prerequisites

1. **Google developer account** — one-time $5 registration at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. **OAuth client (only if shipping Drive sync)** — Google Cloud Console project with OAuth consent screen and Chrome extension client ID. Replace `REPLACE_WITH_OAUTH_CLIENT_ID` in `manifest.json`.
3. **Privacy policy URL** — host `PRIVACY-POLICY.md` (e.g. Netlify, GitHub Pages). Required for `identity` permission.

## Build & package

```bash
cd extension
npm run build          # markmap bundle + assets
npm run test:all       # unit + Playwright (--load-extension)
npm run pack:store     # creates auramindmap-extension.zip
```

Upload `auramindmap-extension.zip` to the developer dashboard. Do **not** include `node_modules/`, tests, or source maps in the zip.

## Listing fields

Use copy from [LISTING.md](./LISTING.md):

- **Title:** AuraMindmap — Sprint Mind Map Editor
- **Summary:** short description (132 chars)
- **Description:** detailed description
- **Category:** Productivity
- **Language:** English

## Review tips

- **Single purpose:** editing sprint mind maps as local markdown files.
- **Optional permissions:** explain that `identity` is only requested when the user enables Drive sync.
- **No remote code:** all JS is bundled; markmap HTML output inlines assets (verified by unit tests).
- **File System Access:** no extension permission needed; document reconnect-folder UX in store description.
- **Side panel:** companion/quick-capture only; full editor opens in standalone window.

## OAuth verification (Drive sync)

If enabling `identity` at launch:

1. Create OAuth 2.0 Client ID → **Chrome Extension** type with your published extension ID (use unpacked ID for testing only).
2. Scope: `https://www.googleapis.com/auth/drive.file` only.
3. Record a short demo video: enable sync → save file → file appears in Drive AuraMindmap folder.

## Post-submission

- Review typically takes 3–10 business days (may be longer during surge periods).
- Respond promptly to policy questions about permissions or data use.
- Keep `npm run test:all` green while review is pending.
- After approval, save the public CWS URL for Phase 2 "Edit in AuraMindmap" deep links (Phase 2 not started yet).

## Unlisted vs public

Consider **unlisted** for the first publish to validate install flow, then switch to **public** once smoke-tested.
