# Structure patterns

How to turn source material into a markmap outline.

## Pattern 1 — Ebook / long summary (default: plain)

**When:** User provides book notes, chapter summary, or pasted summary text.

**Structure:**

- `#` — Book or document title
- `##` — Part, chapter, or major theme
- `###` — Key concept, argument, or takeaway
- `-` — Supporting detail, quote paraphrase, example

**Example skeleton:**

```markdown
# OpenClaw Handbook — Summary

## Part I — Setup
### Install on a VPS
- Clone repo and configure gateway
- Set workspace path in openclaw.json
### Skills vs rules
- Skills are on-demand workflows
- Rules are always-on guidelines

## Part II — Agents
### Workspace layout
- AGENTS.md, SOUL.md, skills/
### Multi-agent routing
- One workspace per agent
```

**Markers:** None.

---

## Pattern 2 — Sprint / task map (with priorities)

**When:** User asks for sprint planning, task breakdown, or XMind-style priorities.

**Structure:**

- `#` — Sprint or project name
- `##` — Workstream / branch name
- `###` — Task (with optional priority + task markers)
- `-` — Subtasks or acceptance criteria

**Example skeleton:**

```markdown
# Sprint Tasks

## OpenClaw
### <span data-m="priority" data-v="1" style="background:#e53935;color:#ffffff;border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">1</span> Fix installation
- Move essentials to Hetzner
### <span data-m="priority" data-v="2" style="background:#fb8c00;color:#333333;border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">2</span> Evaluate intrusion
- Zip OpenClaw folder for analysis
```

See [PRIORITIES.md](PRIORITIES.md) for marker HTML.

---

## Pattern 3 — Simple chapter / topic outline

**When:** User wants a shallow map from a list of topics or meeting notes.

**Structure:**

- `#` — Session or document title
- `##` — Each main topic (keep flat if source is flat)
- `-` — Points under each topic (no `###` unless needed)

**Example skeleton:**

```markdown
# Team Retro — 2026-06-24

## What went well
- Shipped markmap editor
- OpenClaw skill workflow defined

## What to improve
- Document sandbox paths earlier
- Automate PNG on Linux later
```

---

## Slug and output naming

Derive a filename slug from the title:

| Title | Slug | Output files |
|-------|------|--------------|
| OpenClaw Ebook Summary | `openclaw-ebook-summary` | `.md`, `.html`, `.png` |
| Sprint Tasks Q2 | `sprint-tasks-q2` | same |

Use lowercase, hyphens, no spaces. Write to the user-specified **absolute** output directory.

## Depth guidelines

| Source size | Suggested depth |
|-------------|-----------------|
| Short summary (< 500 words) | `#` + `##` + `-` |
| Medium (chapter / section) | `#` + `##` + `###` + `-` |
| Large book | `#` + `##` per chapter + `###` themes + `-` details |

Avoid more than 4 visible levels unless the source truly requires it — markmap readability drops with very deep trees.

## initialExpandLevel

Count nodes after structuring (headings + bullets). Set in YAML frontmatter:

| Nodes | Level |
|-------|-------|
| ≤ 25 | 4 |
| 26–80 | 3 |
| 81–200 | 2 |
| > 200 | 1 |

## Multi-file maps (optional, manual only)

Do **not** auto-split into index + chapter files. Single `.md` per mindmap is the default.

Hyperlinks (`[label](url)`) round-trip in markdown but do not provide XMind-style drill-down between maps. Mention splitting only if the user explicitly asks.
