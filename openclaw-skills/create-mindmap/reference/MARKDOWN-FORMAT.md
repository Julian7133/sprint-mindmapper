# Markdown format for markmap mindmaps

Sprint-mindmapper uses a **heading-based outline**. One markdown file drives both the canvas editor and the interactive markmap HTML export.

## Frontmatter (required)

Start every mindmap file with YAML frontmatter. Copy from `{baseDir}/templates/blank.md`:

```yaml
---
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 4
  maxWidth: 340
---
```

| Option | Purpose |
|--------|---------|
| `colorFreezeLevel` | Stop recoloring below this heading depth (2 = branches keep distinct colors) |
| `initialExpandLevel` | How many levels are expanded on first open |
| `maxWidth` | Max node label width in pixels |

## Heading levels

| Syntax | Role | Example |
|--------|------|---------|
| `#` | Root title (one per file) | `# OpenClaw Ebook Summary` |
| `##` | Top-level branch | `## Chapter 3 — Architecture` |
| `###` | Child node under `##` | `### Key takeaway` |
| `-` bullet | Deeper detail | `- Use absolute paths for output` |

### Indent rules for bullets

Each bullet level adds **2 spaces** before `-`:

```markdown
### Topic
- First detail
  - Nested detail
    - Deeper detail
```

Bullets attach to the nearest heading above them. After a `###`, bullets are children of that node.

## Plain text nodes

Node labels are plain markdown text. No special encoding for German, emoji, or punctuation:

```markdown
## Weiterbildung / 1PMP
### Install OpenClaw on Hetzner
- Notwendiges auf Hetzner umziehen
```

## What NOT to write

- **Mermaid syntax** (`flowchart`, `mindmap` blocks) — use headings instead
- **HTML wrappers** around whole sections — only inline marker spans (see PRIORITIES.md)
- **Relative output paths** in exec commands — always use absolute paths for write + render

## Parse / serialize rules

The parser lives in `SPRINT_MINDMAP_REPO/editor/markmap-convert.mjs`:

- Blank lines are ignored
- Only `#` headings and `-`/`*` bullets are recognized
- Heading depth sets the tree level; bullets extend depth under the current heading
- Optional marker spans at the start of a line are stripped into node metadata (priorities, task progress)

## Minimal valid file

```markdown
---
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 4
  maxWidth: 340
---

# My Mindmap

## Section A
### Idea one
- Detail

## Section B
### Idea two
```
