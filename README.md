# Sprint Mindmap

Personal sprint task planner rendered as a mindmap in the style of
[mindmapai.app](https://mindmapai.app) / [XMind](https://xmind.app), using the
open-source [markmap](https://markmap.js.org) library.

![Sprint tasks](sprint-tasks.png)

## Files

| File | Purpose |
|------|---------|
| `sprint-tasks.md` | **Source of truth.** Heading-based outline with colored priority badges. |
| `sprint-tasks.html` | Interactive mindmap — open in any browser (drag, zoom, collapse). |
| `sprint-tasks.png` | Static screenshot. |
| `sprint-tasks-mindmapai.md` | Same content in mindmapai.app's native export format — re-importable into mindmapai.app to get their exact UI. |
| `render-markmap.sh` | Render `sprint-tasks.md` → HTML + PNG. |

## Render

```bash
./render-markmap.sh
```

Requires Node (uses `npx markmap-cli` on demand) and, for the PNG, Google Chrome.

## Priorities

Priorities are shown as a colored number badge before each task (matching the
mindmapai.app convention):

| Badge | Priority | Color |
|-------|----------|-------|
| 1 | Critical / do now | Red `#e53935` |
| 2 | Soon | Amber `#fb8c00` |
| 3 | Later | Green `#43a047` |

Implemented as inline HTML in the markdown headings:

```html
<span style="background:#e53935;color:#fff;border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">1</span> Task name
```

markmap renders node text as HTML (`foreignObject`), so inline styled spans work.

## markmap frontmatter

```yaml
markmap:
  colorFreezeLevel: 2     # one color per top-level branch, inherited by children
  initialExpandLevel: 4   # show tasks + their detail bullets
  maxWidth: 340           # wrap long node text
```

## Why markmap (and not Mermaid)

This started as a Mermaid `mindmap`, but Mermaid can't reproduce the flowing
curved branches and per-branch coloring of mindmapai.app/XMind even with a custom
theme. markmap consumes the same heading-based markdown that mindmapai.app exports
and renders the near-identical look, so the Mermaid version was retired.

## References

- [markmap](https://markmap.js.org)
- [markmap frontmatter options](https://markmap.js.org/docs/json-options)
