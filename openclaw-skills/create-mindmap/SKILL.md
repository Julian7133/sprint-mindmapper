---
name: create-mindmap
description: >-
  Create heading-based markdown mindmaps and render interactive HTML markmaps
  via sprint-mindmapper. USE when user mentions mindmap, markmap, outline map,
  ebook summary map, chapter breakdown, sprint task map, XMind-style tree.
  PROACTIVELY USE when structuring long summaries, books, or notes into a
  collapsible hierarchy. Do NOT use for flowcharts or sequence diagrams.
homepage: https://github.com/Julian7133/sprint-mindmapper
metadata: {"openclaw":{"requires":{"anyBins":["bash","npx"]},"primaryEnv":"SPRINT_MINDMAP_REPO","emoji":"🗺️"}}
---

# Markmap Mindmaps

Create heading-based `.md` outline files and export to interactive HTML (and optional PNG) using [sprint-mindmapper](https://github.com/Julian7133/sprint-mindmapper).

**Key advantage:** Plain markdown headings — git-friendly, editable in the canvas editor, collapsible markmap view in the browser.

## When to use / when NOT to use

**Use this skill for:** hierarchical outlines — ebook summaries, chapter maps, sprint task trees, meeting notes, knowledge breakdowns. Text source that lives on disk and renders to an interactive markmap.

**Do NOT use it — route elsewhere — for:**
- Flowcharts, sequence diagrams, ER diagrams, state machines → **creating-mermaid-diagrams** ([mermaid-skill](https://github.com/Agents365-ai/mermaid-skill))
- Pixel-precise diagrams or automatic graph layout of processes → Mermaid flowchart / sequence
- Hand-drawn whiteboard sketches → excalidraw / tldraw

> Mermaid has a `mindmap` keyword for radial trees. Use **this skill** when the user wants markdown they can edit in sprint-mindmapper, sprint-style priorities, or markmap HTML export — not Mermaid syntax.

## Prerequisites

**One-time per host (Mac or Hetzner):**

```bash
git clone https://github.com/Julian7133/sprint-mindmapper.git ~/Projects/sprint-mindmapper
```

Set `SPRINT_MINDMAP_REPO` to the clone path (via `~/.openclaw/openclaw.json` — see repo README).

**Runtime deps on PATH:**
- `bash` — runs `render-markmap.sh`
- `npx` — runs `markmap-cli` for HTML export
- `node` — validates markdown round-trip (recommended)

**Check before starting:**

```bash
[ -n "$SPRINT_MINDMAP_REPO" ] && [ -f "$SPRINT_MINDMAP_REPO/render-markmap.sh" ] && echo OK || echo "Set SPRINT_MINDMAP_REPO"
command -v npx >/dev/null && echo "npx OK"
```

## Workflow

1. **Check deps** — confirm `SPRINT_MINDMAP_REPO` and `render-markmap.sh` exist
2. **Gather inputs** — title, **absolute** output directory, source text or file path
3. **Pick pattern** — ebook summary (plain), sprint tasks (priorities), or simple outline — see `{baseDir}/reference/STRUCTURE-PATTERNS.md`
4. **Structure** — `#` root → `##` branches → `###` nodes → `-` bullets
5. **Write** — prepend frontmatter from `{baseDir}/templates/blank.md`; save `<outDir>/<slug>.md`
6. **Validate** — run round-trip check (REQUIRED before render)
7. **Render** — call `render-markmap.sh` with absolute paths
8. **Self-check** — optional vision on PNG if present; otherwise confirm `.html` exists
9. **Review loop** — apply minimal markdown edits per user request; re-validate + re-render
10. **Report** — return absolute paths to `.md`, `.html`, and `.png` if generated

## Validation (Required)

**NEVER render a mindmap without validating first.**

```bash
cd "$SPRINT_MINDMAP_REPO/editor" && node test-roundtrip.mjs "$ABS_MD"
```

Expect output: `PASS round-trip`. If `FAIL round-trip`, fix heading structure or marker HTML and validate again.

Common validation failures:
- Missing or malformed YAML frontmatter
- No `#` root heading
- Inconsistent bullet indent (use 2 spaces per level)
- Broken `<span data-m=...>` marker HTML

Only proceed to render after validation passes.

## Self-check

After render, confirm outputs exist:

```bash
test -f "$ABS_HTML" && echo "HTML OK"
test -f "$ABS_PNG" && echo "PNG OK" || echo "PNG skipped (normal on Linux without Chrome)"
```

If vision is available and PNG was generated, read the PNG and check:
- Labels not clipped
- Tree not unreadably dense — split into more `##` branches if needed
- Root title visible

Max **2 self-check rounds**; re-validate and re-render after each fix.

## Review loop

Show the user output paths (and PNG if available). Apply the **minimal `.md` edit** per request, then re-validate and re-render:

| User request | Edit action |
|---|---|
| Rename a node | Edit heading or bullet text |
| Add / remove a branch | Add or delete `##` / `###` / `-` lines |
| Change priority | Adjust marker spans — see `{baseDir}/reference/PRIORITIES.md` |
| Flatten / deepen | Move content between heading levels or bullets |
| Re-export | Re-run render only (if `.md` unchanged) |

- Overwrite the same `<slug>.md` / `<slug>.html` each round — don't create `v1`, `v2`, …
- **Safety valve:** after 5 rounds, suggest opening `<slug>.html` in a browser or editing in the canvas editor (`cd editor && node server.mjs`).

## Structure patterns

| Pattern | Use for | Markers |
|---------|---------|---------|
| Ebook summary | Book notes, long pasted summary | Plain text |
| Sprint tasks | Prioritized workstreams | Priority 1–5, optional task progress |
| Simple outline | Meeting notes, topic lists | Plain text |

Details: `{baseDir}/reference/STRUCTURE-PATTERNS.md`

## Syntax reference

**Markdown format:** `{baseDir}/reference/MARKDOWN-FORMAT.md`
**Priorities & markers:** `{baseDir}/reference/PRIORITIES.md`
**Frontmatter template:** `{baseDir}/templates/blank.md`

## Examples

### Example 1: Ebook summary mindmap

**User prompt:**
> Create a mindmap from this OpenClaw ebook summary into `/Users/me/mindmaps/openclaw/`

**Generated snippet (`openclaw-ebook-summary.md`):**

```markdown
---
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 4
  maxWidth: 340
---

# OpenClaw Handbook — Summary

## Setup
### Gateway install
- Configure openclaw.json
- Set agents.defaults.workspace
### Skills
- Install via openclaw skills install
- Set SPRINT_MINDMAP_REPO for markmap skill

## Agents
### Workspace files
- AGENTS.md, SOUL.md, skills/
### Sandbox
- Absolute paths may be blocked — write inside workspace if needed
```

**Commands:**

```bash
ABS_MD="/Users/me/mindmaps/openclaw/openclaw-ebook-summary.md"
ABS_BASE="${ABS_MD%.md}"
cd "$SPRINT_MINDMAP_REPO/editor" && node test-roundtrip.mjs "$ABS_MD"
"$SPRINT_MINDMAP_REPO/render-markmap.sh" "$ABS_MD" "$ABS_BASE"
```

**Output files:** `openclaw-ebook-summary.md`, `openclaw-ebook-summary.html`, `openclaw-ebook-summary.png` (PNG best-effort on macOS)

---

### Example 2: Sprint branch with priorities

**User prompt:**
> Add an OpenClaw sprint branch with two prioritized tasks

**Generated snippet:**

```markdown
## OpenClaw
### <span data-m="priority" data-v="1" style="background:#e53935;color:#ffffff;border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">1</span> Installation reparieren
- Notwendiges auf Hetzner umziehen
### <span data-m="priority" data-v="2" style="background:#fb8c00;color:#333333;border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">2</span> Intrusion evaluieren
- Zip vom OpenClaw Ordner erstellen
```

**Output files:** merged into user's sprint `.md` + rendered `.html`

---

### Example 3: Simple chapter outline

**User prompt:**
> Mindmap these three meeting topics to `/tmp/retro.md`

**Generated snippet:**

```markdown
# Team Retro

## Wins
- Shipped markmap editor
- Defined OpenClaw skill

## Blockers
- Sandbox path confusion

## Next steps
- Install create-mindmap skill on Hetzner
```

**Output files:** `/tmp/retro.md`, `/tmp/retro.html`

## Export commands

Always use **absolute paths** for input markdown and output basename:

```bash
ABS_MD="/absolute/path/to/my-map.md"
ABS_BASE="${ABS_MD%.md}"

# Validate (required)
cd "$SPRINT_MINDMAP_REPO/editor" && node test-roundtrip.mjs "$ABS_MD"

# Render HTML (+ PNG best-effort)
"$SPRINT_MINDMAP_REPO/render-markmap.sh" "$ABS_MD" "$ABS_BASE"
```

**PNG note:** `render-markmap.sh` captures PNG via headless Chrome at a macOS path. On Linux/Hetzner, HTML still renders; PNG is skipped with a log message — this is expected.

**Open HTML locally:**

```bash
open "$ABS_BASE.html"    # macOS
xdg-open "$ABS_BASE.html"  # Linux
```

## Common mistakes

| Mistake | Fix |
|---------|-----|
| `SPRINT_MINDMAP_REPO` unset | Set in `openclaw.json` skills.entries.create-mindmap.env |
| Validation skipped | Always run `test-roundtrip.mjs` before render |
| Relative paths in write/render | Use absolute paths for output dir and render args |
| Mermaid syntax in file | Use `#` / `##` / `###` headings instead |
| Missing frontmatter | Copy `{baseDir}/templates/blank.md` block |
| Write failed outside workspace | OpenClaw sandbox — output inside workspace or adjust sandbox |
| Used flowchart for hierarchy | Route to creating-mermaid-diagrams skill |
| Expect PNG on Hetzner | HTML is the primary deliverable; PNG is macOS bonus |
