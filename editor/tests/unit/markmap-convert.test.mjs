import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseMarkdown,
  serializeMarkdown,
  extractPriority,
  badgeHTML,
  splitFrontmatter,
} from '../../markmap-convert.mjs';

const FIXTURE = `---
markmap:
  colorFreezeLevel: 2
---

# Root

## Branch
### <span style="background:#e53935;color:#ffffff;border-radius:50%;padding:1px 7px;font-weight:700;font-size:13px">1</span> Task A
- nested detail
  - deeper
### Task B
`;

function norm(n) {
  return {
    t: n.topic,
    p: n.priority ?? null,
    c: (n.children || []).map(norm),
  };
}

describe('markmap-convert', () => {
  it('splits frontmatter verbatim', () => {
    const { frontmatter, body } = splitFrontmatter(FIXTURE);
    assert.match(frontmatter, /^---\nmarkmap:/);
    assert.match(body, /\n# Root/);
  });

  it('extracts priority from span badge', () => {
    const { priority, topic } = extractPriority(
      '<span style="background:#e53935;color:#fff">2</span> Do thing'
    );
    assert.equal(priority, 2);
    assert.equal(topic, 'Do thing');
  });

  it('parses headings and bullet levels', () => {
    const { root } = parseMarkdown(FIXTURE);
    assert.equal(root.topic, 'Root');
    assert.equal(root.children.length, 1);
    assert.equal(root.children[0].topic, 'Branch');
    const tasks = root.children[0].children;
    assert.equal(tasks[0].topic, 'Task A');
    assert.equal(tasks[0].priority, 1);
    assert.equal(tasks[0].children[0].topic, 'nested detail');
    assert.equal(tasks[0].children[0].children[0].topic, 'deeper');
  });

  it('serializes priority badges with XMind colors', () => {
    const html = badgeHTML(3);
    assert.match(html, /data-m="priority"/);
    assert.match(html, /#fdd835/);
    assert.match(html, />3</);
  });

  it('round-trips structure and priorities', () => {
    const a = parseMarkdown(FIXTURE);
    const md = serializeMarkdown(a.frontmatter, a.root);
    const b = parseMarkdown(md);
    assert.deepEqual(norm(a.root), norm(b.root));
    assert.equal(a.frontmatter.trim(), b.frontmatter.trim());
  });

  it('round-trips hyperlinks', () => {
    const md = `---
markmap:
  colorFreezeLevel: 2
---

# Root

## Branch
### [Docs](https://example.com/docs)
- [Nested link](https://example.com/nested)
`;
    const a = parseMarkdown(md);
    assert.equal(a.root.children[0].children[0].topic, 'Docs');
    assert.equal(a.root.children[0].children[0].hyperLink, 'https://example.com/docs');
    assert.equal(
      a.root.children[0].children[0].children[0].hyperLink,
      'https://example.com/nested'
    );

    const out = serializeMarkdown(a.frontmatter, a.root);
    const b = parseMarkdown(out);
    assert.equal(b.root.children[0].children[0].hyperLink, 'https://example.com/docs');
    assert.equal(b.root.children[0].children[0].topic, 'Docs');
    assert.match(out, /\[Docs\]\(https:\/\/example\.com\/docs\)/);
  });

  it('round-trips multi-line topic text', () => {
    const topic =
      'Website Development: "You know how most company websites are\nout of date? Well, what I do is install software that makes it easy for people\nto update their own websites, without the need to pay a web designer each\ntime. In fact, I installed the software for one of my clients recently, and they\nsaved $2,000 a year in web development costs."';
    const root = {
      id: 'root',
      topic: 'Root',
      children: [
        {
          id: 'me1',
          topic: 'Branch',
          children: [{ id: 'me2', topic, children: [] }],
        },
      ],
    };
    const md = serializeMarkdown('', root);
    const { root: parsed } = parseMarkdown(md);
    assert.equal(parsed.children[0].children[0].topic, topic);
  });

  it('parses legacy multi-line nodes split across physical lines', () => {
    const md = `# Root

## Branch
### Website Development: "You know how most company websites are
out of date? Well, what I do is install software."
### Next task
`;
    const { root } = parseMarkdown(md);
    assert.equal(
      root.children[0].children[0].topic,
      'Website Development: "You know how most company websites are\nout of date? Well, what I do is install software."'
    );
    assert.equal(root.children[0].children[1].topic, 'Next task');
  });

  it('round-trips literal backslash-n in topic text', () => {
    const topic = 'Use \\n for newline in code';
    const root = {
      id: 'root',
      topic: 'Root',
      children: [{ id: 'me1', topic, children: [] }],
    };
    const md = serializeMarkdown('', root);
    const { root: parsed } = parseMarkdown(md);
    assert.equal(parsed.children[0].topic, topic);
  });
});
