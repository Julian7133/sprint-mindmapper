/**
 * Parse / serialize sprint-tasks markdown ↔ Mind Elixir tree.
 * Shared by browser (app.js) and Node (test-roundtrip.mjs, server).
 */

import { parseLineContent, markerPrefixHTML, escapeTopicNewlines } from './markers.mjs';

export {
  badgeHTML,
  priorityMarkerHTML,
  markerPrefixHTML,
  parseLineContent,
  escapeTopicNewlines,
  unescapeTopicNewlines,
} from './markers.mjs';

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

/** @deprecated */
export function extractPriority(text) {
  const parsed = parseLineContent(text);
  return { priority: parsed.priority, topic: parsed.topic };
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

function lineToNode(level, rawText, idCounter, nextId) {
  const parsed = parseLineContent(rawText);
  const node = {
    id: level === 1 ? 'root' : `me${nextId()}`,
    topic: parsed.topic,
    children: [],
  };
  if (level > 1) {
    if (parsed.priority) node.priority = parsed.priority;
    if (parsed.taskProgress != null) node.taskProgress = parsed.taskProgress;
    if (parsed.flag) node.flag = parsed.flag;
    if (parsed.star) node.star = parsed.star;
    if (parsed.people) node.people = parsed.people;
    if (parsed.hyperLink) node.hyperLink = parsed.hyperLink;
  }
  return node;
}

export function parseMarkdown(text) {
  const { frontmatter, body } = splitFrontmatter(text);
  const lines = body.split('\n');
  let root = null;
  const stack = [];
  let headingLevel = 0;
  let idCounter = 0;
  const nextId = () => ++idCounter;
  let continuationMode = false;

  for (const raw of lines) {
    if (!raw.trim()) {
      if (continuationMode && stack.length) {
        stack[stack.length - 1].node.topic += '\n';
      }
      continue;
    }

    const headingMatch = raw.match(/^(#+)\s+(.*)$/);
    if (headingMatch) {
      continuationMode = false;
      const level = headingMatch[1].length;
      headingLevel = level;
      const node = lineToNode(level, headingMatch[2], idCounter, nextId);
      attachNode(root, stack, level, node, (r) => {
        root = r;
      });
      continue;
    }

    const bulletMatch = raw.match(/^(\s*)(?:[-*]|\d+[.)])\s+(.*)$/);
    if (bulletMatch) {
      continuationMode = false;
      const indent = countIndent(bulletMatch[1]);
      const level = headingLevel + 1 + Math.floor(indent / 2);
      const node = lineToNode(level, bulletMatch[2], idCounter, nextId);
      attachNode(root, stack, level, node, (r) => {
        root = r;
      });
      continue;
    }

    if (stack.length) {
      stack[stack.length - 1].node.topic += `\n${raw}`;
      continuationMode = true;
    }
  }

  if (!root) {
    root = { id: 'root', topic: 'Sprint Tasks', children: [] };
  }

  return { frontmatter, root };
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

  const markers = depth > 0 ? markerPrefixHTML(node) : '';
  let topicText = escapeTopicNewlines(node.topic);
  if (node.hyperLink) {
    topicText = `[${topicText}](${node.hyperLink})`;
  }
  const text = markers ? `${markers}${topicText}` : topicText;

  if (depth === 1) out.push('');
  out.push(prefix + text);

  for (const child of node.children || []) {
    walkNode(child, depth + 1, out);
  }
}
