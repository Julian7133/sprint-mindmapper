# OpenClaw agents

Create mindmaps from any OpenClaw agent using the **create-mindmap** skill. Structure is modeled on [Agents365-ai/mermaid-skill](https://github.com/Agents365-ai/mermaid-skill); this skill targets heading-based markmap outlines (ebook summaries, sprint trees), not Mermaid flowcharts.

## One-time setup (Mac or Hetzner)

Clone this repo on each host:

```bash
git clone https://github.com/Julian7133/sprint-mindmapper.git ~/Projects/sprint-mindmapper
```

Install the skill (workspace path varies — pick one):

```bash
openclaw skills install ~/Projects/sprint-mindmapper/openclaw-skills/create-mindmap
# or global: openclaw skills install --global ~/Projects/sprint-mindmapper/openclaw-skills/create-mindmap
# or from git: openclaw skills install git:Julian7133/sprint-mindmapper@main --path openclaw-skills/create-mindmap
```

Set the repo path in `~/.openclaw/openclaw.json`:

```json5
{
  skills: {
    entries: {
      "create-mindmap": {
        enabled: true,
        env: { SPRINT_MINDMAP_REPO: "/home/you/Projects/sprint-mindmapper" },
      },
    },
  },
}
```

Use your actual clone path (`~/Projects/sprint-mindmapper` on Mac, `/home/you/...` on Hetzner).

## Invoke

- Slash command: `/create-mindmap`
- Or natural language: *"Create a mindmap from this ebook summary to `/path/out/`"*

The agent writes a `.md` file (any absolute path), validates it, then runs `render-markmap.sh` to produce `.html` (+ `.png` on macOS when Chrome is available).

## Ebook summary example

Source: `/tmp/openclaw-summary.txt` → output dir: `/Users/me/mindmaps/openclaw/`

The agent produces `/Users/me/mindmaps/openclaw/openclaw-ebook-summary.md`, validates with `editor/test-roundtrip.mjs`, renders to `.html`, and reports all output paths.

## Sandbox note

If the agent cannot write outside its workspace, save the mindmap inside the workspace or adjust OpenClaw sandbox settings.

Skill files: [`create-mindmap/`](create-mindmap/)
