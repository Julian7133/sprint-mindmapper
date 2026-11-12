# Google Drive app + Workspace Marketplace setup

This folder documents how to connect the AuraMindmap **preview app** (`preview-app/`) to Google Drive and publish it on the Google Workspace Marketplace.

The preview app is configured for `https://aura.berlow.de` (Netlify). It registers as an **Open with** handler for markdown mind maps and hands off editing to the Chrome extension.

---

## 1. Google Cloud project

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable APIs:
   - **Google Drive API**
   - **Google Workspace Marketplace SDK**
3. Configure the **OAuth consent screen**:
   - User type: External (or Internal for a single Workspace domain)
   - App name: **AuraMindmap**
   - Support email + developer contact
   - Logo: use the same icon set as the extension (`extension/icons/`)
   - Authorized domains: `berlow.de` (registrable parent domain; Preview origin is `https://aura.berlow.de`)
   - Scope: `https://www.googleapis.com/auth/drive.file` only (non-sensitive)

## 2. OAuth client (Web application)

Create an OAuth 2.0 **Web application** client:

| Setting | Value |
|---|---|
| Authorized JavaScript origins | `https://aura.berlow.de`, `http://localhost:8888` (local dev) |
| Authorized redirect URIs | Not required for GIS token client implicit flow |

Copy this **Web application** Client ID into `preview-app/config.js` → `GOOGLE_CLIENT_ID`.

The Chrome extension uses a **separate** OAuth client of type **Chrome Extension** (item ID = published extension ID) → `extension/manifest.json` → `oauth2.client_id`. Two clients, both in this Cloud project, both request only `drive.file` (decision 2026-10-24; order in `docs/2026-10-store-launch-checklist.md`).

## 3. Drive “Open with” integration

In [Google Cloud Console → Google Drive → API & Services → Drive UI integration](https://console.cloud.google.com/apis/credentials) (or the Drive SDK configuration page):

1. **Application name:** AuraMindmap
2. **Open URL:** `https://aura.berlow.de/`
   Google appends a `state` query param (URL-encoded JSON with `ids: [fileId]`). The preview app parses this via `parse-file-id.js`.
3. **MIME types / file extensions:**
   - `text/markdown` → `.md`
   - (Optional later) custom type for `.smm` if you register a branded extension
4. Upload icons (16×16, 128×128) matching Marketplace branding guidelines.

Test locally with:

```text
http://localhost:8888/?state=%7B%22ids%22%3A%5B%22YOUR_FILE_ID%22%5D%2C%22action%22%3A%22open%22%7D
```

## 4. Workspace Marketplace listing

1. Open [Google Workspace Marketplace SDK](https://console.cloud.google.com/marketplace) for the same Cloud project.
2. Create an app listing:
   - **App type:** Drive / Web app (not Editor add-on)
   - **Install URL / Open URL:** `https://aura.berlow.de/`
   - **Support URL:** https://berlow.de/kontakt (existing contact page; Julian must add AuraMindmap support guidance). **Privacy policy URL:** https://berlow.de/datenschutz (existing website policy; Julian must extend it for Preview/Extension before submission). **Imprint:** https://berlow.de/impressum. Terms of service are missing; Julian must supply them. No legal text is invented here.
   - **Category:** Productivity
   - **Search keywords:** mind map, mindmap, markdown, sprint planning, markmap
3. Copy for the listing lives in `preview-app/store-listing/LISTING.md`.
4. Screenshots: 1280×800 (and small tile 440×280). Capture the preview app with a rendered map + top bar (Download HTML / Edit buttons visible).

### Policy checklist

- [ ] Preview renders a real interactive mind map (primary value)
- [ ] “Edit in AuraMindmap” is a secondary button, not the whole screen
- [ ] No claim of being an official Google product
- [ ] OAuth scope limited to `drive.file`
- [ ] Demo video for OAuth verification shows: Drive → Open with → preview → Edit handoff

## 5. Extension handoff (`externally_connectable`)

The preview app sends:

```js
chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'auramindmap:open-drive-file',
  fileId,
  fileName, // markdown filename, e.g. Sprint.md
  markdown, // content already loaded by the preview; no tokens
});
```

`extension/background.js` imports `background-external.mjs` and handles `onMessageExternal`. The listener allows exactly `https://aura.berlow.de` and `http://localhost:8888`, validates the file data (maximum 1,048,576 UTF-16 code units), and rejects extra fields, including tokens. Chrome match patterns cannot restrict localhost to one port, so `http://localhost/*` in the manifest is narrowed by the listener. No staging origins are allowed.

Each request is stored under a random `driveHandoff:<requestId>` key in `chrome.storage.session`. A new editor window opens with `?handoff=<requestId>`. The workspace moves the content to browser-local file storage and removes the pending message. Drafts survive editor reloads; the ordinary folder workspace and already-open editors are untouched. **This edits a local copy**: Save opens a local `.md` save dialog; it does not update the Drive original. The editor displays this explicitly. The extension needs no OAuth token for the handoff.

Without the extension, the button navigates to the Chrome Web Store listing in the same tab (also works with popup blocking). After installation, return to the preview, reload, and click Edit again. No file-ID paste workflow is claimed.

After publishing the extension, set `CONFIG.EXTENSION_ID` and `CONFIG.CWS_LISTING_URL` in `preview-app/config.js`.

## 6. OAuth verification

`drive.file` is **non-sensitive** ([Google Drive scope reference](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)). Complete any branding or app verification requested by the Cloud Console; do not assume a fixed review time.

Prepare:

1. Short screencast: user opens `.md` from Drive → preview loads → optional Edit → extension opens with file
2. Justification text: “Read markdown files the user opens with this app; no access to other Drive files.”
3. Privacy policy URL on a public HTTPS page

Review timing depends on Google; no duration is guaranteed.

## 7. Deployment (Netlify)

Repo settings (also in `preview-app/netlify.toml`):

- **Base directory:** `preview-app`
- **Publish directory:** `.` (relative to the base directory)
- **Build command:** none required (committed `markmap-bundle.js`); optional `npm run build` if you add CI rebuild

Julian configures hosting/DNS; no deployment or DNS change is part of the dev round:

1. Add `aura.berlow.de` as a custom production domain in the Preview Netlify site.
2. In the existing `berlow.de` DNS zone create **CNAME** host/name **`aura`**, target **the actual `<site-name>.netlify.app` hostname shown by Netlify** (without `https://` or a path). The Netlify site name is not present in this repo, so the exact target remains a Julian step. Do not change the apex domain or nameservers.
3. Wait for DNS verification, provision HTTPS in Netlify, and verify `https://aura.berlow.de/` with the production response headers. The sandbox map frame has a separate, restricted CSP; the OAuth page keeps its stricter policy.
4. Authorize `berlow.de` in the Google consent screen; set the Web client origin and Drive Open URL to `https://aura.berlow.de` and `https://aura.berlow.de/` respectively. Set extension/client/listing IDs in the files above.

[Netlify external DNS instructions](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/).

## 8. Post-launch checks

1. Drive: right-click a `.md` mind map → **Open with → AuraMindmap**
2. Marketplace search: “mindmap”, “markdown mind map”
3. Edit button with extension installed → editor opens with file content
4. Edit button without extension → Chrome Web Store listing; return, reload, and retry after installation
