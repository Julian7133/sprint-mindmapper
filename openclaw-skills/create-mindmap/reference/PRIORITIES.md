# Priority and task markers (optional)

Use markers for **sprint task maps** where priority and progress matter. For ebook summaries and generic notes, skip markers — plain headings are enough.

## When to add markers

| Use case | Markers |
|----------|---------|
| Ebook / chapter summary | None (plain text) |
| Sprint / task planning | Priority 1–5, optional task progress |
| Generic notes | Agent decides; default to none |

## Priority levels (1–5)

| Level | Label | Color |
|-------|-------|-------|
| 1 | Critical | Red |
| 2 | High | Orange |
| 3 | Medium | Yellow |
| 4 | Low | Green |
| 5 | Lowest | Blue |

Place the priority span **before** the node label on `###` lines (tasks):

```markdown
### <span data-m="priority" data-v="1" style="background:#e53935;color:#ffffff;border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">1</span> Critical task title
```

Replace `data-v="1"` and the inline `style` colors per level:

| Level | `data-v` | `background` | `color` |
|-------|----------|--------------|---------|
| 1 | 1 | `#e53935` | `#ffffff` |
| 2 | 2 | `#fb8c00` | `#333333` |
| 3 | 3 | `#fdd835` | `#333333` |
| 4 | 4 | `#43a047` | `#333333` |
| 5 | 5 | `#1e88e5` | `#ffffff` |

## Task progress marker (optional)

Shows XMind-style completion on a task node. Place after priority, before label:

```markdown
### <span data-m="priority" data-v="2" style="background:#fb8c00;color:#333333;border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">2</span> <span data-m="task" data-v="5" style="display:inline-block;width:16px;height:16px;border:2px solid #43a047;border-radius:50%;vertical-align:middle;margin-right:4px;background:conic-gradient(#43a047 0deg 315deg, transparent 315deg);"></span> Task in progress
```

| `data-v` | Meaning |
|----------|---------|
| 0 | Start (play icon) |
| 1–5 | 12% … 88% progress (conic fill) |
| 6 | Done (checkmark) |

## Other markers (rare)

Flag, star, and people markers use `data-m="flag"`, `data-m="star"`, `data-m="people"` with `data-v="1"` … `7`. See `SPRINT_MINDMAP_REPO/editor/markers.mjs` for full HTML templates.

## Example sprint branch

```markdown
## Agent Architektur
### <span data-m="priority" data-v="2" style="background:#fb8c00;color:#333333;border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">2</span> CEO Agent
- Basis Matt Mochary Buch
### <span data-m="priority" data-v="3" style="background:#fdd835;color:#333333;border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">3</span> Sales Agent
- Subagent von CEO
```

## Tip

If unsure whether to add markers, **omit them**. The canvas editor can add priorities later via hotkeys 1–5 when opened in the sprint-mindmapper editor.
