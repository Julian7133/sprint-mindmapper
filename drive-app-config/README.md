# Google Drive app + Workspace Marketplace setup

This folder documents how to connect the AuraMindmap **preview app** (`preview-app/`) to Google Drive and publish it on the Google Workspace Marketplace.

The preview app is hosted at `https://preview.auramindmap.com` (Netlify). It registers as an **Open with** handler for markdown mind maps and hands off editing to the Chrome extension.

---

## 1. Google Cloud project

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable APIs:
   - **Google Drive API**
   - **Google Workspace Marketplace SDK**
3. Configure the **OAuth consent screen**:
   - User type: External (or Internal for a single Workspace domain)
   - App name: **AuraMindmap Viewer** (or your chosen public name)
   - Support email + developer contact
   - Logo: use the same icon set as the extension (`extension/icons/`)
   - Authorized domains: `auramindmap.com`, `netlify.app` (if using Netlify subdomain during staging)
   - Scope: `https://www.googleapis.com/auth/drive.file` only (sensitive, not restricted)

## 2. OAuth client (Web application)

Create an OAuth 2.0 **Web application** client:

| Setting | Value |
|---|---|
| Authorized JavaScript origins | `https://preview.auramindmap.com`, `http://localhost:8888` (local dev) |
| Authorized redirect URIs | Not required for GIS token client implicit flow |

Copy the **Client ID** into:

- `preview-app/config.js` → `GOOGLE_CLIENT_ID`
- `extension/manifest.json` → `oauth2.client_id` (same client or a separate Chrome extension client — both need `drive.file`)

> Use separate OAuth clients for the web preview and the Chrome extension if Google review asks for clearer separation. Both must request only `drive.file`.

## 3. Drive “Open with” integration

In [Google Cloud Console → Google Drive → API & Services → Drive UI integration](https://console.cloud.google.com/apis/credentials) (or the Drive SDK configuration page):

1. **Application name:** AuraMindmap Viewer
2. **Open URL:** `https://preview.auramindmap.com/`  
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
   - **Install URL / Open URL:** `https://preview.auramindmap.com/`
   - **Support URL / Privacy policy URL:** host a privacy policy (see `extension/store-listing/PRIVACY-POLICY.md` as a starting point)
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
});
```

The extension (`extension/background.js`) validates `sender.origin` (`https://preview.auramindmap.com` or `http://localhost`), stores `pendingDriveFileId` in `chrome.storage.session`, and opens the editor window. On boot, `app.js` calls `ws.consumePendingDriveFile()` → `ws.loadDriveFile(fileId)`.

After publishing the extension, set `CONFIG.EXTENSION_ID` and `CONFIG.CWS_LISTING_URL` in `preview-app/config.js`.

## 6. OAuth verification

`drive.file` is **sensitive** (not restricted) — usually no paid third-party security assessment.

Prepare:

1. Short screencast: user opens `.md` from Drive → preview loads → optional Edit → extension opens with file
2. Justification text: “Read markdown files the user opens with this app; no access to other Drive files.”
3. Privacy policy URL on a public HTTPS page

Typical review time: 1–3 weeks after submission.

## 7. Deployment (Netlify)

Repo settings (also in `preview-app/netlify.toml`):

- **Base directory:** `preview-app`
- **Publish directory:** `preview-app`
- **Build command:** none required (committed `markmap-bundle.js`); optional `npm run build` if you add CI rebuild

Custom domain: `preview.auramindmap.com` → CNAME to Netlify.

## 8. Post-launch checks

1. Drive: right-click a `.md` mind map → **Open with → AuraMindmap Viewer**
2. Marketplace search: “mindmap”, “markdown mind map”
3. Edit button with extension installed → editor opens with file content
4. Edit button without extension → Chrome Web Store listing + file ID copied to clipboard
