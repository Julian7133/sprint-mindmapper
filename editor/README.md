# Sprint Mindmap Editor

Canvas editor for `sprint-tasks.md`. Edits autosave to a local draft; **Save** writes the markdown file and regenerates the markmap HTML.

## Start

```bash
cd editor
node server.mjs
# optional: node server.mjs /path/to/sprint-tasks.md
```

Open [http://127.0.0.1:8731](http://127.0.0.1:8731)

**Open folder…** (Files panel): pick a folder of `.md` mindmaps via the native directory picker (Chrome/Edge). The choice is remembered; on next launch you’ll see **Reconnect folder** until you grant access again. Safari: use `node server.mjs /path/to/file.md` instead.

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

1. Edit tasks on the canvas (Tab = child, Enter = sibling, **drag to reorder or reparent branches**).
   - **Drag a branch**: select a task and drag it — drop above/below a sibling to reorder, or onto a node to make it a child. A blue insert preview shows the drop zone. The whole subtree moves with the node. Root cannot be dragged; hold Space and drag to pan the canvas instead.
   - **Type-to-edit**: select a task and start typing to replace its label.
   - **Preserve edit**: double-click or F2 to edit with existing text intact.
   - **Multi-line paste**: select a task and paste plain text — choose to split into siblings, add as a child outline, or keep as one topic (XMind-style). Bullets and indented lines are detected automatically.
2. Select a task, then set markers in the **Markers** panel (bottom-left):
   - **Priority** 1–7 (quick: **Cmd/Ctrl+1…7**, clear **Cmd/Ctrl+Shift+0**)
   - **Task** progress (start → 12% → … → done)
   - **Flag**, **Star**, **People** (colored 1–7)
   - Click again to clear; **×** clears a row
3. Toggle panel: **Markers** button or **Ctrl/Cmd+Shift+M**
4. **Same priority only** (bottom-right): dims other priorities when a prioritized task is selected.
5. **Save** or **Ctrl/Cmd+S** → writes `sprint-tasks.md`, updates draft cache, runs `render-markmap.sh`.
6. Open `sprint-tasks.html` for the read-only markmap view.

Draft cache: `sprint-tasks.md.editor-draft` (same folder as the markdown file).

## Shortcuts

| Key | Action |
|-----|--------|
| Tab | Add child |
| Enter | Add sibling |
| Drag node | Move branch (before / after / child drop zones) |
| Type (node selected) | Overwrite label (type-to-edit) |
| Paste (node selected) | Multi-line: split into siblings / child outline / one topic |
| Double-click / F2 | Edit label (preserve existing text) |
| Cmd/Ctrl+1…7 | Set priority (task selected) |
| Cmd/Ctrl+Shift+0 | Clear priority |
| Cmd/Ctrl+Shift+M | Toggle Markers panel |
| Toolbar Markers panel | Priority, task, flag, star, people |
| Cmd/Ctrl+Shift+P | Toggle same-priority filter |
| Cmd/Ctrl+S | Save to markdown + render markmap |
| F6 | Focus on selected branch (MindElixir focus mode) |
| Shift+F6 | Exit focus mode |
| F1 / Fit | Center map |
| Space | Expand/collapse selected node |

## Tests

```bash
cd editor
npm install
npm run lint          # ESLint
npm run test          # unit tests + markdown round-trip
npm run test:e2e      # Playwright browser tests
npm run test:all      # lint + unit + e2e
```
