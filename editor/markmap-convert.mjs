/**
 * Parse / serialize sprint-tasks markdown ↔ Mind Elixir tree.
 * Shared by browser (app.js) and Node (test-roundtrip.mjs, server).
 */

export const PRIORITY = {
  1: { bg: '#e53935', fg: '#ffffff' },
  2: { bg: '#fb8c00', fg: '#333333' },
  3: { bg: '#fdd835', fg: '#333333' },
  4: { bg: '#43a047', fg: '#333333' },
  5: { bg: '#1e88e5', fg: '#ffffff' },
};

const MAX_PRIORITY = 5;

export function badgeHTML(p) {
  const c = PRIORITY[p];
  if (!c) return '';
  return (
    `<span style="background:${c.bg};color:${c.fg};border-radius:50%;` +
    `padding:1px 7px;font-weight:700;font-size:13px">${p}</span>`
  );
}

export function splitFrontmatter(text) {
  if (!text.startsWith('---\n')) {
    return { frontmatter: '', body: text };
  }
  const end = text.indexOf('\n---', 4);
  if (end === -1) {
    return { frontmatter: '', body: text };
  }
  const frontmatter = text.slice(0, end + 4);
  const body = text.slice(end + 4).replace(/^\n/, '');
  return { frontmatter, body };
}

export function extractPriority(text) {
  const spanMatch = text.match(/^\s*<span\b[^>]*>(\d+)<\/span>\s*/i);
  if (spanMatch) {
    const priority = clampPriority(parseInt(spanMatch[1], 10));
    return { priority, topic: text.slice(spanMatch[0].length).trim() };
  }
  return { priority: undefined, topic: text.trim() };
}

function clampPriority(n) {
  if (!Number.isFinite(n)) return undefined;
  if (n < 1 || n > MAX_PRIORITY) return undefined;
  return n;
}

function countIndent(raw) {
  let n = 0;
  for (const ch of raw) {
    if (ch === ' ') n += 1;
    else if (ch === '\t') n += 2;
    else break;
  }
  return n;
}

export function parseMarkdown(text) {
  const { frontmatter, body } = splitFrontmatter(text);
  const lines = body.split('\n');
  let root = null;
  const stack = [];
  let headingLevel = 0;
  let idCounter = 0;

  for (const raw of lines) {
    if (!raw.trim()) continue;

    const headingMatch = raw.match(/^(#+)\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      headingLevel = level;
      const { priority, topic } = extractPriority(headingMatch[2]);
      const node = makeNode(level, topic, priority, idCounter, () => ++idCounter);
      attachNode(root, stack, level, node, (r) => {
        root = r;
      });
      continue;
    }

    const bulletMatch = raw.match(/^(\s*)[-*]\s+(.*)$/);
    if (bulletMatch) {
      const indent = countIndent(bulletMatch[1]);
      const level = headingLevel + 1 + Math.floor(indent / 2);
      const { priority, topic } = extractPriority(bulletMatch[2]);
      const node = makeNode(level, topic, priority, idCounter, () => ++idCounter);
      attachNode(root, stack, level, node, (r) => {
        root = r;
      });
    }
  }

  if (!root) {
    root = { id: 'root', topic: 'Sprint Tasks', children: [] };
  }

  return { frontmatter, root };
}

function makeNode(level, topic, priority, idCounter, nextId) {
  return {
    id: level === 1 ? 'root' : `me${nextId()}`,
    topic,
    priority: level === 1 ? undefined : priority,
    children: [],
  };
}

function attachNode(root, stack, level, node, setRoot) {
  if (level === 1) {
    setRoot(node);
    stack.length = 0;
    stack.push({ level, node });
    return;
  }

  while (stack.length && stack[stack.length - 1].level >= level) {
    stack.pop();
  }

  const parent = stack.length ? stack[stack.length - 1].node : root;
  if (parent) parent.children.push(node);
  stack.push({ level, node });
}

export function serializeMarkdown(frontmatter, root) {
  const out = [];
  if (frontmatter) {
    out.push(frontmatter.trimEnd(), '');
  }

  walkNode(root, 0, out);
  return `${out.join('\n')}\n`;
}

function walkNode(node, depth, out) {
  const prefix =
    depth === 0
      ? '# '
      : depth === 1
        ? '## '
        : depth === 2
          ? '### '
          : `${' '.repeat((depth - 3) * 2)}- `;

  const text =
    node.priority && depth > 0
      ? `${badgeHTML(node.priority)} ${node.topic}`
      : node.topic;

  if (depth === 1) out.push('');
  out.push(prefix + text);

  for (const child of node.children || []) {
    walkNode(child, depth + 1, out);
  }
}
