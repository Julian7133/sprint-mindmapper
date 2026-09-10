# Implementation Plan — Multi-map tabs, cross-map linking, native macOS app

Status: M1 complete, M2 complete, M3 implemented (unsigned native build verified 2026-09-08). Order: M1 → M2 → M3. Features first; native wrapper last.

Guiding decisions (confirmed with Julian):
- Tabs share **one connected folder** (matches today's workspace model). No multi-folder tabs.
- Tabs must be **detachable into separate browser windows** for multi-monitor arrangement.
- Cross-map links **reuse MindElixir's existing `hyperLink`** with an app-internal URL scheme,
  rather than inventing a new link primitive.

## Baseline (what exists today)
- `editor/app.js` holds a **single** `MindElixir` instance (`mind`) and module-global state
  (`activeFile`, `workspaceFiles`, `renamingFile`). One map visible at a time.
- `editor/workspace.mjs` abstracts storage as `server` mode (`/api/*`) or `folder` mode
  (File System Access API). It tracks a single `activeFile`. Storage is already keyed per
  `relPath`, and drafts are keyed per `(folderId, relPath)` in IndexedDB — already multi-file safe.
- MindElixir natively supports: `hyperLink` (external URL, already used via "Set link…"),
  `arrows` (intra-map node-to-node arrows, not yet exposed), `summary`. None cross files.

---

## Milestone 1 — Multiple maps as tabs (shared folder)

Goal: open several maps at once as tabs; switch between them; detach a tab into a new window.

### Design
- Introduce a **MapDoc** concept: `{ relPath, mind, container, dirty, scheduleDraftSave }`.
  Refactor `app.js` so per-map wiring (MindElixir instance, `decorate`, markers, paste handler,
  draft autosave) is created per document instead of once at module load.
- **Tab bar** above `#map`. Each open MapDoc = one tab (label = file name, close button).
  Clicking a file in the sidebar opens/activates its tab.
- Rendering: one hidden container `<div>` per open doc; show the active one. Keeps each
  MindElixir instance alive so switching tabs is instant and preserves scroll/zoom.
- **Persist** the open-tab set + active tab in folder meta (`meta.openTabs`, `meta.activeFile`)
  so a reload restores the session.
- **Detach to new window**: `window.open('index.html?file=<rel>')`. The new window boots the
  same persisted folder handle via `ws.init()` → `reconnectSavedFolder()` (may re-prompt for
  permission). Windows coordinate through a `BroadcastChannel('sprint-map')`: on save, the
  saving window posts `{file}`; other windows showing that file reload from disk (and warn if
  they hold an unsaved draft) to avoid clobbering.

### Tasks
1. Extract per-map state into a `createMapDoc(relPath)` factory; move the global `mind` wiring
   (context menu "Set link…", paste, markers, decorate, draft-save) inside it.
2. Add tab-bar DOM + CSS; render/activate/close tabs; keyboard shortcut to cycle tabs.
3. Replace `openFile(rel)` with `openTab(rel)` (focus if open, else create doc + load md/draft).
4. Scope document-level listeners (paste, priority hotkeys, type-to-edit) to the **active** doc,
   since they are currently attached at `document` level and would fire for all instances.
5. Persist/restore `openTabs` + `activeFile` in folder meta.
6. "Open in new window" action on a tab → `window.open`.
7. `BroadcastChannel` save-sync between windows (reload-on-save, stale-draft guard).
8. Tests: unit for tab-state reducer; e2e for open two tabs / switch / close / reopen persists /
   detach opens second window.

### Risks
- Multiple MindElixir instances sharing global keyboard/paste listeners → must route by active
  instance (Task 4). This is the main refactor risk.
- Cross-window unsaved-draft conflicts → mitigated by BroadcastChannel + stale warning.

---

## Milestone 2 — Cross-map links + backlinks

Goal: link a node to another map (or a node inside another map); show backlinks.

### Design
- **Link scheme**: keep using `hyperLink`. Internal targets encoded as
  `map:<relPath>` or `map:<relPath>#<nodeId>`. External `http(s)` links behave as before.
- **Picker dialog** replaces the raw `prompt()` in the "Set link…" context menu. Two modes:
  *External URL* | *This folder* (list maps; optionally drill into a map to pick a target node).
- **Click interception**: nodes whose `hyperLink` starts with `map:` open/activate the target
  tab (Milestone 1) and select the target node id; external links open normally.
- **Backlinks panel**: index every `map:` hyperLink across the folder's maps → "Linked from"
  list for the active map/node. Rebuild on save (BroadcastChannel triggers reindex).

### Key dependency — stable node IDs
MindElixir node ids must survive the markdown roundtrip, or `#<nodeId>` links break on edit.
`editor/markmap-convert.mjs` + `markers.mjs` likely do **not** persist ids today.
**Spike first** (Task 1): decide between (a) encoding an id anchor in the markdown, or
(b) a sidecar `.links.json`, with a **topic-path fallback** when an id can't be resolved.

**Decision (Task 1, implemented):** use **inline anchors** — a trailing `<!--smm:ID-->`
comment persisted per node in `markmap-convert.mjs` (`NODE_ID_RE` / `nodeIdSuffix`). Chosen
over a sidecar because it keeps each node's id with its own line (no separate file to write,
sync, or go stale — important under the File System Access API / extension), adds no server
dependency, and round-trips through the existing parse/serialize. The fragment
(`map:<relPath>#<ref>`) is resolved by exact id first, then by **topic path** (`link-target.mjs`),
then gracefully to the map root for broken targets.

### Tasks
1. Spike: verify/ensure node-id persistence across md roundtrip; pick id-persistence strategy. ✔
2. Link picker dialog (external vs internal; map + optional node selection). ✔
3. `map:` click interception → `openTab` + `selectNode`. ✔
4. Folder-wide link index + backlinks panel UI. ✔
5. Reindex on save (BroadcastChannel). ✔
6. Tests: create internal link → click navigates + selects; backlinks list correct; roundtrip
   preserves link + id; broken-target fallback. ✔

### Risks
- Node-id persistence is the crux; fall back to topic-path addressing if ids can't be stable.

---

## Milestone 3 — Native macOS app (implemented 2026-09-08; production signing pending)

Goal: ship a proper `.app` / `.dmg` with unrestricted file access and native UX.

### Design
- Wrap the finished editor in **Tauri v2**. A third `workspace.mjs` mode,
  `native` (in `native-app/`), is backed by thin Rust fs commands + the official
  dialog/store/opener plugins — no Chrome-only `showDirectoryPicker`, no local
  `server.mjs`.
- Native **File menu** (New Map / Open folder / New window) mapped to the
  Milestone-1 tab/detached-window model. `app.js` is reused unchanged: the
  native bridge (loaded before it) rewrites the URL for detached windows and
  dispatches menu actions to existing DOM controls.
- Markmap render step reuses the **in-browser** markmap bundle (same as the
  extension) — no Rust/node sidecar.
- Code signing + notarization + `.dmg` scaffolding in `native-app/release/`
  (env-driven, no committed secrets).

### Tasks (state)
1. Tauri shell + `native` workspace mode. ✔ (compiled with Tauri 2.11.5)
2. Native menu / window management wired to tabs + detached windows. ✔ (compiled; launch smoke-tested)
3. Render pipeline (in-browser markmap bundle, no sidecar). ✔
4. Signing, notarization, `.dmg` packaging + release script. ◐ (unsigned `.app`/`.dmg` built and verified; Developer ID signing/notarization requires credentials)

### Notes
- `native-app/` frontend is staged from the canonical `editor/` (and the single
  `extension/editor/markmap-render.mjs`) — no manual divergence.
- `cargo check`, the release build, and a launch smoke test pass on Apple Silicon.
  The generated unsigned DMG passes `hdiutil verify`; production distribution
  still requires an Apple Developer signing identity and notarization credentials.

---

## Validation gate (every milestone)
`npm run lint` + `npm test` (unit) + `npm run test:e2e` green before moving on.
