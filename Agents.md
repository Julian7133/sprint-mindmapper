# Agents.md — Central Codebase Contract

Cross-provider reference for all AI agents (Claude, Cursor, OpenCode, etc.) working on this project. **Read this before touching any code.** This is maintained by the primary orchestrating agent; do not overwrite without updating the timestamp.

_Last updated: 2026-09-08_

---

## Codebase Memory (graph index)

The codebase is indexed in `codebase-memory-mcp`. **Always query it first** before grepping or reading files blindly.

- **Project name:** `Users-julianberlow-dev-sprint-mindmap`
- **Nodes / edges:** 629 / 1299 (as of 2026-07-07)
- Tools: `search_graph`, `get_code_snippet`, `search_code`, `get_architecture`, `trace_path`

Preferred lookup order:
1. `search_graph(query=...)` — find functions/classes by name or natural language
2. `get_code_snippet(qualified_name=...)` — read exact source for a known symbol
3. `search_code(pattern=...)` — text/regex search with graph enrichment
4. Only then: Read the file directly

---

## Repo Structure

```
editor/                       # PWA editor (runs via Node server OR File System Access API)
  app.js                      # Main entry — 894 lines, calls workspace.* + MindElixir
  workspace.mjs               # Workspace façade (see §Workspace Interface below)
  folder-workspace.mjs        # File System Access API backend
  workspace-storage.mjs       # IndexedDB helpers (idbGet/idbSet/idbDelete, draft keys, folder handle)
  markmap-convert.mjs         # Pure-JS markdown ↔ MindElixir tree (browser + Node, no server dep)
  markers.mjs                 # Marker/badge HTML + parse logic
  marker-picker.mjs           # UI: marker picker panel
  priority-hotkeys.mjs        # Keyboard shortcuts for priorities
  paste-nodes.mjs             # Paste handling
  import-formats.mjs          # XMind / OPML → markdown import
  type-to-edit.mjs            # Type-to-edit mode
  server.mjs                  # Node HTTP server (dev/local only); NOT present in extension
  service-worker.js           # PWA service worker (cache shell assets)
  index.html                  # Entry HTML
  style.css
  vendor/                     # Bundled MindElixir JS + CSS
  tests/
    unit/                     # Node unit tests (Vitest)
    e2e/                      # Playwright browser tests
render-markmap.sh             # Shell: calls `npx markmap-cli` → .html + .png (server-side only)
```

---

## Workspace Interface Contract

`createWorkspace()` in `editor/workspace.mjs` is the **single swap point** for all backends. The extension's `workspace-extension.mjs` must implement the same interface.

**Full interface (all async unless noted):**

```js
// Lifecycle
ws.init()                          // → { awaitingReconnect: bool, folderLabel?: string }
ws.reconnectSavedFolder()          // → folderApi (restores persisted handle; asks user permission)
ws.openFolderPicker()              // → folderApi (shows OS picker, saves handle)
ws.dismissSavedFolder()            // → void (clears saved handle, resets to server mode)

// Read-only properties (sync)
ws.mode                            // 'server' | 'folder'
ws.folderName                      // string | null
ws.supportsNativeFolder            // bool
ws.isFolderMode()                  // bool
ws.current()                       // current backend object

// File operations
ws.getInfo()                       // → { mode, folderName, activeFile, markdownName, draftExists, files }
ws.listFiles()                     // → string[] (relative paths, sorted)
ws.readMarkdown(relPath)           // → string
ws.readDraft(relPath)              // → string
ws.writeDraft(relPath, text)       // → void
ws.saveMarkdown(relPath, text)     // → { rendering: bool }
ws.createFile(name)                // → relPath (string)
ws.renameFile(from, to)            // → relPath (string)
ws.importBinary(filename, buffer)  // → { file: relPath }

// Active file tracking
ws.setActiveFile(relPath)          // → void
ws.getActiveFile()                 // → relPath | null
ws.persistActiveFile(relPath)      // → void (folder mode only; saves to IndexedDB)

// Markmap
ws.getMarkmapHtml(relPath)         // → string (HTML) | null
ws.pollRenderStatus()              // → { status: 'running'|'done'|'error'|'idle', message?, file? }

// URL helpers
ws.fileQuery()                     // → '?file=...' | ''
```

**Behaviour notes:**
- `saveMarkdown` returns `{ rendering: true }` in server mode (triggers `/api/render` + shell script), `{ rendering: false }` in folder mode (markmap HTML written synchronously by the folder workspace calling `/api/render` first).
- In folder mode, `saveMarkdown` calls `/api/render` (POST `{ markdown, basename }`) to get HTML back, then writes it to the folder alongside the `.md` file. This **server call must be eliminated** in the extension — replace with the in-browser markmap renderer (see §Markmap Rendering).
- `importBinary` in folder mode also calls `/api/import/convert` (server). Same issue for the extension.

---

## Markmap Rendering

**Current architecture (server-dependent):**
- `render-markmap.sh` runs `npx markmap-cli@latest <input.md> -o <output.html>`
- `server.mjs` calls this via `spawn('bash', ...)` on save (server mode) OR returns HTML via `/api/render` POST (folder mode)
- `folder-workspace.mjs:saveMarkdown` calls `/api/render` and writes the returned HTML to disk

**For the Chrome Extension (task 1.5) — in-browser rendering:**
- `markmap-convert.mjs` already parses markdown → MindElixir tree; it is **not** the markmap HTML renderer
- Need to bundle `markmap-lib` + `markmap-view` (the same packages `markmap-cli` uses under the hood) into the extension
- The in-browser render function should accept markdown text and return a self-contained HTML string
- This replaces the `/api/render` fetch in `folder-workspace.mjs` within the extension's workspace implementation

---

## Key Module Boundaries

| From | To | What flows |
|---|---|---|
| `app.js` | `workspace.mjs` | All file I/O (18 call sites) |
| `workspace.mjs` | `folder-workspace.mjs` | Delegates when mode='folder' |
| `folder-workspace.mjs` | `workspace-storage.mjs` | IndexedDB (handle, drafts, meta) |
| `app.js` | `markmap-convert.mjs` | Parse/serialize markdown ↔ MindElixir (4 call sites) |
| `app.js` | `marker-picker.mjs` | Marker UI (13 call sites) |

---

## Storage Layer (IndexedDB via workspace-storage.mjs)

```js
openDb()                                // DB name: 'sprint-mindmap', version 1
idbGet(storeName, key)
idbSet(storeName, key, value)
idbDelete(storeName, key)

// High-level helpers:
saveFolderWorkspace({ handle, meta })   // store: 'folder-workspace', key: 'current'
loadSavedFolderWorkspace()              // → { handle, meta } | null
clearSavedFolderWorkspace()
readDraftKey(key)                       // store: 'drafts'
writeDraftKey(key, text)
deleteDraftKey(key)
```

Draft keys are namespaced: `${folderId}:${relPath}` (from `draftKey()` in folder-workspace.mjs).

---

## Extension Architecture (Phase 1)

```
extension/
  manifest.json              # MV3; permissions: storage, identity (optional), sidePanel (optional)
  background.js              # Service worker: open window on action click
  editor/
    index.html               # Copy of editor/index.html (minus PWA manifest link)
    app.js                   # Unchanged (repointed imports)
    workspace-extension.mjs  # NEW — implements workspace interface; no server calls
    drive-sync.mjs           # NEW (optional) — chrome.identity + Drive REST API
    markmap-render.mjs       # NEW — in-browser markmap render (markmap-lib + markmap-view)
    ... (copied modules: markmap-convert.mjs, markers.mjs, marker-picker.mjs,
         priority-hotkeys.mjs, type-to-edit.mjs, paste-nodes.mjs, import-formats.mjs)
    vendor/MindElixir.js
    vendor/style.css
    style.css
    service-worker.js
    icons/icon-16.png icon-48.png icon-128.png
```

`workspace-extension.mjs` eliminates ALL `server.*` paths:
- No `/api/*` fetch calls
- `init()` restores handle from IndexedDB (`chrome.storage.local` or `indexedDB` directly)
- `saveMarkdown` calls in-browser markmap renderer instead of `/api/render`
- `importBinary` runs `importToMarkdown` from `import-formats.mjs` client-side (already pure JS)

### Extension boot gotchas (learned the hard way — do NOT repeat)

- **MV3 CSP blocks inline `<script type="importmap">`.** The redirect from `workspace.mjs` → `workspace-extension.mjs` must be a real file: `extension/editor/workspace.mjs` is a one-line re-export (`export * from './workspace-extension.mjs'`), NOT an import map. `app.js` imports `./workspace.mjs` unchanged.
- **`app.js` MUST be copied** into `extension/editor/` (it is the editor entry point). Easy to forget when copying the "shared modules".
- **Lazy-import heavy deps.** `workspace-extension.mjs` imports `import-formats.mjs` (which pulls `fast-xml-parser` + `jszip`) lazily inside `importBinary`, so a missing/broken dep doesn't crash module load at startup.
- **`import-formats.mjs` needs `fast-xml-parser` + `jszip`** in `extension/package.json` dependencies — not just devDeps.
- **Script/asset paths must be relative** (`./app.js`, `./vendor/style.css`), never root-absolute (`/app.js`) — the extension root ≠ `editor/`.
- **Render via the esbuild bundle at runtime, never the source.** `workspace-extension.mjs` dynamic-imports `./markmap-bundle.js` (markmap-lib/-view inlined, browser-resolvable). It must NOT import `./markmap-render.mjs` — that source has bare `markmap-*` imports which don't resolve in an extension page, silently degrading rendering to a `<pre>` dump. Node unit tests won't catch this (Node resolves node_modules). The service worker precaches the bundle (not the source); `pretest` runs the full build so the bundle exists for tests; the workspace unit test mocks the *bundle* path to guard the import.
- **CSP "no CDN" checks go on the rendered OUTPUT, not the bundle source** — markmap-lib's bundle contains dead `jsdelivr`/`unpkg` provider templates that are never invoked.
- `pollRenderStatus()` always returns `{ status: 'idle' }`

---

## Preview App Architecture (Phase 2)

```
preview-app/               # Hosted at e.g. preview.auramindmap.com (Netlify)
  index.html               # GIS OAuth, reads ?fileId=, renders markmap read-only
  app.js                   # OAuth flow (drive.file scope), files.get, markmap render
  markmap-render.mjs       # Shared with extension: in-browser markmap renderer
  style.css
```

Protocol handoff: `auramindmap-edit://drive/<fileId>` (registered via `protocol_handlers` in extension manifest). Fallback: link to CWS listing.

---

## Native App Architecture (Phase 3 — Tauri)

```
native-app/
  src/                     # native-only frontend sources
    workspace-native.mjs     # full Workspace Interface Contract impl (Tauri)
    native-core.mjs          # pure folder-file logic (unit-tested, no Tauri)
    native-paths.mjs         # pure rel-path/root resolution helpers
    native-store.mjs         # plugin-store wrapper (meta + drafts)
    native-bridge.mjs        # menu/window/opener integration, loaded before app.js
  scripts/
    stage.mjs                # copies shared editor/extension modules into dist/ + writes index.html
    build-assets.mjs         # generates dist/embedded-assets.mjs (markmap CDN inlining)
    build.mjs                # esbuild-bundles workspace-native + native-bridge
  src-tauri/                 # Rust shell (fs/menu/window commands, capabilities, icons)
  release/                   # macOS signing / notarization / DMG scaffolding
  tests/unit/                # Node unit tests for core/paths/staging
```

Key choices:
- **No manual divergence**: `scripts/stage.mjs` copies the canonical shared
  modules from `../editor/` (app.js, tab-state, link-*, markers, paste-nodes,
  markmap-convert, …) and the single in-browser markmap renderer from
  `../extension/editor/markmap-render.mjs`. `app.js` is reused **unchanged**.
- The workspace swap point is the real re-export file `dist/workspace.mjs` →
  `./workspace-native.bundle.js` (MV3/CSP-safe pattern, like the extension).
- `workspace-native.mjs` reports `mode === 'folder'` + `isNative()`, so app.js
  needs no changes. File I/O is thin Rust commands; meta/drafts persist via
  `plugin-store` (shared across windows → multi-window model).
- Markmap rendering reuses the in-browser markmap bundle (no Node sidecar).
- The native bridge (`native-bridge.bundle.js`) is injected into the staged
  index.html **before** app.js: it rewrites the URL for detached windows
  (from Rust's injected `window.__amDetachFile`) and dispatches File-menu
  actions to existing DOM controls.
- Native menu: File → New Map (Cmd+N) / Open Folder… (Cmd+O) / New Window
  (Cmd+Shift+N). New/detached windows are created in Rust (`open_new_window`)
  — no frontend window permissions needed.

Notes / blockers:
- The Tauri 2.11.5 source passes `cargo check`; an Apple Silicon release build
  produces an unsigned `.app` and `.dmg`, and the app passes a launch smoke test.
- Signing/notarization is env-driven (`native-app/release/`); an Apple Developer
  identity is still required and no secrets are committed.

---

## Test Setup

- **Unit:** `editor/tests/unit/` — Vitest; run with `npm run test` in `editor/`
- **E2E:** `editor/tests/e2e/` — Playwright; run with `npm run test:e2e`
- **All:** `npm run test:all`
- Extension e2e: use `--load-extension` Playwright flag (task 1.9)
- **Native unit:** `native-app/tests/unit/` — `node --test`; run with `npm test` in `native-app/` (or `npm run native:test` at root). Covers `native-core`, `native-paths`, and `stage` logic.

---

## Open Decisions (as of 2026-07-07)

- [x] App name: AuraMindmap
- [x] Hosting: Netlify
- [x] File extension: `.md` only (no custom `.smm`)
- [ ] Drive sync (1.7): optional, off by default in v1
- [ ] Side panel (1.8): optional v1
- [ ] Paid tiers: defer post-launch
