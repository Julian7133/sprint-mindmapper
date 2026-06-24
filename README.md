# Sprint Mindmap

Task mindmap for sprint planning. One markdown file drives both a **canvas editor** (XMind-style) and a **markmap** view for sharing and git diffs.

![Sprint tasks](sprint-tasks.png)

## Quick start

### Edit (canvas)

```bash
cd editor
node server.mjs
```

Open [http://127.0.0.1:8731](http://127.0.0.1:8731). Edits autosave to a draft; **Save** (`Ctrl/Cmd+S`) writes `sprint-tasks.md` and refreshes the markmap HTML.

See [editor/README.md](editor/README.md) for shortcuts and details.

### View (markmap)

```bash
open sprint-tasks.html
```

Or regenerate from markdown:

```bash
./render-markmap.sh
```

## Source of truth

`sprint-tasks.md` — heading-based outline with optional priority badges. German task names are plain text; no special encoding needed.

```markdown
## Branch name
### <span style="background:#e53935;color:#fff;...">1</span> Task title
- Detail bullet
```

## Priorities (5 levels)

| Level | Label | Color |
|-------|-------|-------|
| 1 | Critical | Red |
| 2 | High | Orange |
| 3 | Medium | Yellow |
| 4 | Low | Green |
| 5 | Lowest | Blue |

Set in the editor with **1…5** (clear: **0**) or the toolbar priority buttons. Saved badges render the same in markmap.

### Install as app (macOS)

```bash
cd editor && node server.mjs
```

Then in Chrome: **Install app** in the toolbar. In Safari: **File → Add to Dock…**. See [editor/README.md](editor/README.md).

## Files

| File | Purpose |
|------|---------|
| `sprint-tasks.md` | Task data (committed) |
| `sprint-tasks.html` | Read-only markmap (regenerated on Save) |
| `sprint-tasks.png` | Screenshot from `render-markmap.sh` |
| `editor/` | Canvas editor app |
| `render-markmap.sh` | Markdown → HTML + PNG |

## markmap options (frontmatter)

```yaml
---
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 4
  maxWidth: 340
---
```
