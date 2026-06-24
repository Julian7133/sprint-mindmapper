# Sprint Mindmap Editor

Canvas editor for `sprint-tasks.md`. Edits autosave to a local draft; **Save** writes the markdown file and regenerates the markmap HTML.

## Start

```bash
cd editor
node server.mjs
# optional: node server.mjs /path/to/sprint-tasks.md
```

Open [http://127.0.0.1:8731](http://127.0.0.1:8731)

Works offline (Mind Elixir is bundled in `vendor/`). Static assets are cached via a service worker for PWA install.

## Install as app (macOS)

The editor is a **Progressive Web App**. The local server must be running (`node server.mjs`).

### Chrome / Edge

1. Open http://127.0.0.1:8731
2. Click **Install app** in the toolbar (or the install icon in the address bar)
3. The app opens in its own window without browser chrome

### Safari

1. Open http://127.0.0.1:8731
2. **File → Add to Dock…**
3. Launch from Dock like a native app

## Workflow

1. Edit tasks on the canvas (Tab = child, Enter = sibling, drag to reorder).
2. Select a task, then set priority:
   - Press **1…5** (clear: **0**), or
   - Click the colored **Priority** buttons in the toolbar
3. **Same priority only** (bottom-right): dims other priorities; enabled only when a prioritized task is selected.
4. **Save** or **Ctrl/Cmd+S** → writes `sprint-tasks.md`, updates draft cache, runs `render-markmap.sh`.
5. Open `sprint-tasks.html` for the read-only markmap view.

Draft cache: `sprint-tasks.md.editor-draft` (same folder as the markdown file).

## Shortcuts

| Key | Action |
|-----|--------|
| Tab | Add child |
| Enter | Add sibling |
| 1…5 | Set priority (task selected, not editing) |
| 0 | Clear priority |
| Toolbar Priority 1…5 / × | Set / clear priority |
| Ctrl/Cmd+Shift+P | Toggle same-priority filter |
| Ctrl/Cmd+S | Save to markdown + render markmap |
| F1 / Fit | Center map |
| Space | Expand/collapse selected node |

On macOS, plain digit keys are used instead of Option+Shift combos (those produce special characters and are unreliable in browsers).

## Tests

```bash
cd editor
npm install
npm run test          # unit tests + markdown round-trip
npm run test:e2e      # Playwright browser tests
npm run test:all      # both
```
