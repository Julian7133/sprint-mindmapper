# Google Workspace Distribution Plan

Distribution strategy for Sprint Mindmap to Google Workspace users.

- **Goal:** Make the Sprint Mindmap editor available to Google Workspace users with the least effort and best UX, while gaining visibility in the Google Workspace Marketplace search.
- **Strategy:** Two-phase rollout.
  1. Ship a **Chrome Extension** (Chrome Web Store) that reuses the existing editor and works for both personal Chrome users and Google Workspace users.
  2. Ship a lightweight **Google Drive preview app** (Google Workspace Marketplace) that registers as an "Open with" handler for `.md` mindmap files, offers a read-only markmap preview, and funnels users to the Chrome extension for editing. This is the acquisition surface inside Workspace search.
- **Explicitly out of scope:** A full Docs/Slides Editor add-on with a 300 px sidebar. The canvas UX is too constrained there for the effort required.

> Reference research notes (see prior conversation):
> - MindMup is a Drive-connected web app (`.mup` files, "Open with" in Drive, editor opens in a new tab). We follow the same model but lighter.
> - Google Workspace Marketplace policies forbid add-ons whose **sole purpose** is launching another product, so the Drive app must provide real standalone value (preview).

---

## Phase 1 — Chrome Extension (primary editor)

**Owner:** TBD
**Duration:** 2–4 weeks (one engineer)
**Distribution:** Chrome Web Store (one-time $5 developer fee)

### 1.1 Scope

Package the existing PWA editor as a Manifest V3 Chrome extension that:
- Opens the full canvas editor in a **standalone window** (default) and optionally a **side panel** (companion view).
- Saves `.md` mindmaps locally via the web **File System Access API** (keeps the current folder-picker UX) or, as fallback, via `chrome.downloads` to the Downloads folder.
- Optionally syncs to Google Drive using `chrome.identity.getAuthToken` + the Drive REST API.
- Works offline (extension pages + service worker cache the bundled `vendor/` and app shell).
- Reuses the existing MindElixir canvas, markdown converter, marker picker, priority hotkeys, paste logic, and export (PNG/SVG/markmap HTML).

### 1.2 Architecture

```
extension/
  manifest.json
  background.js              # MV3 service worker (window launch, identity, install handler)
  editor/
    index.html               # ~= editor/index.html, minus manifest link
    app.js                   # ~= editor/app.js, with ws.* calls repointed
    workspace-extension.mjs  # new: replaces workspace.mjs; chrome.storage + File System Access API + chrome.downloads
    drive-sync.mjs           # new: optional, wraps Drive REST API via chrome.identity
    ... (copy: markmap-convert.mjs, markers.mjs, marker-picker.mjs, priority-hotkeys.mjs, type-to-edit.mjs, paste-nodes.mjs)
    vendor/MindElixir.js
    vendor/style.css
    style.css
    service-worker.js        # app-shell cache (replaces editor/service-worker.js)
    icons/icon-16.png icon-48.png icon-128.png  # new
```

**Key repoint:** the editor's `workspace.mjs` abstraction (`ws.init`, `ws.readMarkdown`, `ws.saveMarkdown`, `ws.readDraft`, `ws.writeDraft`, `ws.listFiles`, `ws.openFolderPicker`, etc.) is the swap point. A new `workspace-extension.mjs` re-implements the same interface on top of `chrome.storage.local`, `indexedDB` (for File System Access handles), and `chrome.downloads`. The rest of `app.js` stays unchanged.

### 1.3 Task breakdown

| # | Task | Effort | Blocks |
|---|---|---|---|
| 1.1 | Create `extension/` scaffold, manifest v3, icons, load unpacked in Chrome | ½ day | — |
| 1.2 | Implement `background.js`: open standalone window on action click, keyboard shortcut | 1 day | 1.1 |
| 1.3 | Implement `workspace-extension.mjs`: File System Access API for open folder / save file; `chrome.storage.local` for drafts and active-file pointer; `indexedDB` to persist file handles | 3–5 days | 1.1 |
| 1.4 | Repoint `app.js` imports to `workspace-extension.mjs`; remove `node server.mjs` dependency; verify the editor boots in extension window | 1–2 days | 1.3 |
| 1.5 | Replace markmap render hook: render markmap HTML client-side in the extension (port the logic from `server.mjs` / `render-markmap.sh`) instead of polling the Node server | 2 days | 1.4 |
| 1.6 | Offline shell: update `service-worker.js` to precache the extension-page assets; verify offline load | 1 day | 1.4 |
| 1.7 | (Optional) `drive-sync.mjs`: sign in via `chrome.identity.getAuthToken`, list/save `.md` files in an app-specific Drive folder; show a "Sync to Drive" button | 3–5 days | 1.4 |
| 1.8 | Side panel mode: a reduced toolbar variant that opens in `chrome.sidePanel` for quick capture alongside other tabs | 1–2 days | 1.4 |
| 1.9 | Adapts tests: Playwright config to load the extension via `--load-extension`; keep the existing e2e specs where possible | 1–2 days | 1.4 |
| 1.10 | Store listing assets: 1280×800 screenshots, 440×280 small tile, 256×256 icons, privacy policy URL, single-purpose description, permissions justification | 1–2 days | — |
| 1.11 | Submit to Chrome Web Store; respond to review feedback | 3–10 days (review) | all above |

### 1.4 Key decisions

- **Window vs. popup:** default to a standalone window (`chrome.windows.create({ type: 'popup' })` sized ~1280×800). The popup only hosts a "Open editor" button + recent files list.
- **File storage default:** keep the File System Access folder-picker UX from the current editor. The folder permission persists per-extension so reconnect prompts work the same way.
- **Drive sync:** optional and off by default in v1 to limit OAuth scoping and review time. Turn it on once the extension is stable.
- **No remote code:** MindElixir and all vendored JS stay bundled. Workspace add-on policies forbid remote-loaded code, and CWS prefers it too.

### 1.5 Risks

| Risk | Mitigation |
|---|---|
| CWS review rejects broad "fileSystem" or "tabs" permissions | Only request `storage`, `downloads` (if used), `identity` (if Drive sync). File System Access API needs no extension permission. |
| File System Access handles don't survive extension reinstall | Document "Reconnect folder" UX; store handles per profile in indexedDB and offer fallback to Downloads. |
| Side panel too narrow for canvas | Treat side panel as a companion/quick-capture surface only; full editor lives in the standalone window. |
| CWS review queue longer than expected (April 2026 surge noted) | Submit early; test via `--load-extension` while review is pending. |

### 1.6 Acceptance

- Extension loads unpacked, boots the editor, can open a folder of `.md` files, edit, save, and regenerate the markmap — all without Node running.
- Pass: `npm run test:all` (with Playwright pointed at the extension).
- CWS listing public and reachable via direct link.

---

## Phase 2 — Google Drive preview app (Marketplace acquisition)

**Owner:** TBD
**Duration:** 2–3 weeks (one engineer),. Can start once Phase 1 is in review.
**Distribution:** Google Workspace Marketplace (no listing fee; requires Google Cloud project + OAuth verification).

### 2.1 Scope

A minimal hosted web app that:
- Registers as a **Google Drive "Open with" handler** for `.md` files (and a custom `.smm` extension is optional) so that "Open with → Sprint Mindmap Viewer" appears in Drive.
- When opened from Drive, fetches the file via the Drive REST API and renders a **read-only markmap** (no canvas editing) inside a Workspace-styled page.
- Shows a secondary button: **"Edit in Sprint Mindmap"**. If the Chrome extension is installed, opens the extension's editor with the file loaded; otherwise deep-links to the Chrome Web Store listing.
- Has a Marketplace store listing that ranks for "mindmap" / "mind map" queries in Google Workspace Marketplace search.

### 2.2 Architecture

```
preview-app/                       # hosted web app, e.g. preview.sprintmindmap.com
  index.html                       # Workspace-styled shell; reads ?fileId=...
  app.js                           # Google Identity Services (GIS) OAuth, Drive files.get, markmap render
  render-markmap-inbrowser.mjs     # port of render-markmap.sh into pure JS
  style.css
  manifest.webmanifest
drive-app-config/                  # Google Drive app / Marketplace SDK config (documented, not code)
  README.md                        # GCP project setup, OAuth client, Drive integration config, MIME type registration
```

Handoff to the extension: the viewer calls a custom URL scheme `sprintmindmap-edit://drive/<fileId>` that the extension registers (via `protocol_handlers` in its manifest) when installed; if not installed, the button is a plain link to the CWS listing.

### 2.3 Task breakdown

| # | Task | Effort | Blocks |
|---|---|---|---|
| 2.1 | Stand up hosting (e.g. Cloud Run or Netlify) with HTTPS; pick a domain | ½ day | — |
| 2.2 | Build `preview-app`: GIS OAuth implicit flow with `drive.file` scope; `files.get` for the file ID; render markmap client-side using the existing `markmap-convert.mjs` + `markmap-view` bundle | 3–4 days | 2.1 |
| 2.3 | Port `render-markmap.sh` logic to pure JS so the preview works without shell/Puppeteer | 1 day | 2.2 |
| 2.4 | Add "Edit in Sprint Mindmap" button: `protocol_handlers` callback path if installed → open extension window with file; else link to CWS listing | 1 day | 1.4 (extension), 2.2 |
| 2.5 | Extension side: register `protocol_handlers` for `sprintmindmap-edit://`; on launch, resolve fileId via Drive API, download content, switch active file | 1 day | 1.4 |
| 2.6 | Marketplace setup: Google Cloud project, OAuth consent screen (sensitive scope: `drive.file`), enable Google Workspace Marketplace SDK, configure app listing, Drive integration MIME types, branding assets, privacy policy | 1–2 days | 2.2 |
| 2.7 | Submit for OAuth verification (record demo video) + Marketplace review | 1–2 days hands-on, 1–3 weeks review | all above |
| 2.8 | Verify search visibility: search Marketplace for "mindmap" / "markdown" and confirm the listing appears; iterate on listing title/keywords | ½ day | 2.7 |

### 2.4 Marketplace policy compliance checklist

- [ ] The viewer provides **real standalone value** (renders a mindmap preview) — not a launcher-only app.
- [ ] External link to the extension is **secondary** (a button, not the whole screen); the preview is the primary experience.
- [ ] Privacy policy URL live and accurate.
- [ ] OAuth scopes limited to `drive.file` (narrowest, user-granted per file).
- [ ] No claims about being an official Google product; branding guidelines respected.
- [ ] App review demo video included.

### 2.5 Risks

| Risk | Mitigation |
|---|---|
| OAuth verification requires a security assessment for "restricted" scopes | Use `drive.file` only (not full `drive`); this scope is sensitive but not restricted and usually avoids paid assessment. |
| Reviewers reject the app as "launcher-only" | Make the preview genuinely polished: pan/zoom, expand/collapse, export PNG/SVG/HTML from the viewer. Polish the preview itself, not the launch button. |
| Extension not yet published when the Drive app goes live | The "Edit" button deep-links to the CWS listing; works either way. |
| Custom protocol handler UX is awkward on first run | Fall back to clipboard copy of the file ID + a "Paste file ID in the extension" affordance as a bridge. |

### 2.6 Acceptance

- Searching "mindmap" in Google Workspace Marketplace returns the Sprint Mindmap Viewer listing.
- Opening a `.md` file from Google Drive → "Open with → Sprint Mindmap Viewer" renders the mindmap in a new tab.
- The "Edit" button opens the Chrome extension with the file loaded (when installed) or sends the user to the CWS listing.

---

## Phase 3 (optional) — Hosted full editor

If Drive users want to edit without installing the extension:
- Host the same editor app as a public web app (e.g. `app.sprintmindmap.com`).
- Reuse the extension's `workspace-extension.mjs` (minus `chrome.*` APIs) with an IndexedDB-backed workspace.
- Drive IO via GIS OAuth (same as the preview app).
- Effort: 3–6 weeks.
- Defer until Phase 1 + 2 show real adoption.

---

## Timeline (indicative)

| Week | Phase 1 | Phase 2 |
|---|---|---|
| 1 | Scaffolding + workspace-extension.mjs | — |
| 2 | Repoint app.js + client-side markmap render | Host preview app + port render to JS |
| 3 | Optional Drive sync + side panel + tests | Marketplace + OAuth setup, register Drive MIME type |
| 4 | Store assets + submit to CWS | Submit to Marketplace (OAuth verification video) |
| 5–7 | Handle CWS review feedback (parallel) | Handle Marketplace review feedback (parallel) |
| 8 | Public CWS launch | Public Marketplace launch, verify search ranking |

---

## Open questions

1. Hosting choice for the preview app: Cloud Run, Netlify, Vercel? Decide in Phase 2 week 1.
2. Do we want a dedicated `.smm` mindmap file extension registered with Drive, or just hook into `.md`? Hooking `.md` is faster; a custom extension gives stronger brand identification but requires users to create files via the app.
3. Free vs. paid tiers for the extension? CWS does not support one-time payments anymore (Stripe/Paddle externally is the modern route). Defer pricing until after launch.
4. Should the extension support Google Workspace admin-installable distribution (enterprise bulk deploy)? Answer after seeing initial demand from Workspace admins.

---

## Decision log

- 2026-07-07: Chose Chrome Extension as primary product (reuse, full canvas UX, broadest audience). Chose Workspace Marketplace Drive preview app as secondary acquisition surface (passes "single purpose" policy, gives Marketplace search presence). Ruled out a Docs/Slides Editor add-on because the 300 px sidebar is too small for the canvas UX and the effort is disproportionate.