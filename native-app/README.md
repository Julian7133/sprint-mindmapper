# AuraMindmap — native macOS app (Tauri v2)

A desktop wrapper for the browser editor with **unrestricted file access**
(native folder picker, no local `server.mjs`, no Chrome-only
`showDirectoryPicker`). It reuses the shared `editor/` frontend modules so the
browser editor, Chrome extension, and native app stay in sync without manual
divergence.

## Layout

```
native-app/
  src/                 # native-only frontend sources
    workspace-native.mjs  # full Workspace Interface Contract impl (Tauri)
    native-core.mjs       # pure folder-file logic (unit-tested, no Tauri)
    native-paths.mjs      # pure rel-path/root resolution helpers
    native-store.mjs      # plugin-store wrapper (meta + drafts)
    native-bridge.mjs     # menu/window/opener integration loaded by index.html
  scripts/
    stage.mjs             # copies shared editor/extension modules into dist/ + writes index.html
    build-assets.mjs      # generates dist/embedded-assets.mjs (markmap CDN inlining)
    build.mjs             # esbuild-bundles workspace + native-bridge
  src-tauri/           # Rust shell
    src/{main,lib,fs,menu,window}.rs
    capabilities/default.json
    tauri.conf.json
    entitlements.plist
    icons/                # generated from app-icon.png (npm run icons)
  release/             # macOS signing / notarization / DMG scaffolding
  tests/unit/          # Node unit tests for core/paths/staging
```

## How the frontend is assembled (no manual divergence)

`scripts/stage.mjs` copies the canonical shared modules from `../editor/`
(app.js, tab-state, link-*, markers, paste-nodes, markmap-convert, …) and the
single canonical in-browser markmap renderer from `../extension/editor/` into
`dist/`. It then:

- writes `dist/workspace.mjs` as a real one-line re-export to
  `./workspace-native.bundle.js` (the MV3/CSP-safe swap pattern),
- generates `dist/index.html` from `editor/index.html` with path rewrites +
  native-bridge injection,
- generates `dist/embedded-assets.mjs` (inlined markmap CDN assets).

`scripts/build.mjs` esbuild-bundles `workspace-native.mjs` (Tauri API +
markmap renderer + import-formats, self-contained — **no server**) and
`native-bridge.mjs`.

## Commands

```sh
npm install
npm run build      # stage + bundle the frontend into dist/
npm test           # unit tests (core, paths, staging)
npm run dev        # build + tauri dev (requires Rust toolchain)
npm run build:app  # build + tauri build (.app)
./release/release.sh            # .app + .dmg (see release/README.md)
```

## Workspace mode

The native backend implements the full **Workspace Interface Contract**
(`editor/workspace.mjs`) and reports `mode === 'folder'` with `isNative()`
true, so `app.js` needs no changes. File I/O goes through thin Rust commands;
folders/sessions/drafts persist via `plugin-store` in the OS app-config dir
(shared across windows, enabling the multi-window model).

Markdown → markmap HTML uses the same in-browser renderer as the extension
(`markmap-render.mjs` bundled at build time). There is **no Node sidecar**.

## Known gaps / blockers

- The Tauri 2.11.5 source passes `cargo check`; the Apple Silicon release build
  produces `AuraMindmap.app` and an unsigned `.dmg`, and the app passes a launch
  smoke test.
- Production signing/notarization needs an Apple Developer account (see
  `release/`).
