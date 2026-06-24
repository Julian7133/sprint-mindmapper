/**
 * Convert OPML, FreeMind (.mm), and XMind (.xmind) to heading/bullet markdown.
 */
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

function titleFromFilename(name) {
  const base = name.replace(/\.(md|opml|mm|xmind)$/i, '');
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeMd(text) {
  return String(text ?? '').replace(/\[/g, '\\[');
}

function nodeToMarkdown(title, children = [], depth = 0) {
  const lines = [];
  const prefix =
    depth === 0 ? '# ' : depth === 1 ? '## ' : depth === 2 ? '### ' : `${'  '.repeat(depth - 3)}- `;
  lines.push(`${prefix}${escapeMd(title)}`);
  for (const child of children) {
    lines.push(...nodeToMarkdown(child.title, child.children, depth + 1));
  }
  return lines;
}

function normalizeChildren(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseOpml(xml) {
  const doc = xmlParser.parse(xml);
  const body = doc?.opml?.body;
  const outlines = normalizeChildren(body?.outline);
  if (!outlines.length) {
    return `# Imported\n`;
  }
  const lines = [];
  for (const outline of outlines) {
    walkOpml(outline, 0, lines);
  }
  return `${lines.join('\n')}\n`;
}

function walkOpml(outline, depth, lines) {
  const title = outline['@_text'] || outline['@_title'] || 'Untitled';
  const prefix =
    depth === 0 ? '# ' : depth === 1 ? '## ' : depth === 2 ? '### ' : `${'  '.repeat(depth - 3)}- `;
  lines.push(`${prefix}${escapeMd(title)}`);
  for (const child of normalizeChildren(outline.outline)) {
    walkOpml(child, depth + 1, lines);
  }
}

function parseFreemind(xml) {
  const doc = xmlParser.parse(xml);
  const root = doc?.map?.node;
  if (!root) return `# Imported\n`;
  const lines = [];
  walkFreemind(root, 0, lines);
  return `${lines.join('\n')}\n`;
}

function walkFreemind(node, depth, lines) {
  const title = node['@_TEXT'] || node['@_text'] || 'Untitled';
  const prefix =
    depth === 0 ? '# ' : depth === 1 ? '## ' : depth === 2 ? '### ' : `${'  '.repeat(depth - 3)}- `;
  lines.push(`${prefix}${escapeMd(title)}`);
  for (const child of normalizeChildren(node.node)) {
    walkFreemind(child, depth + 1, lines);
  }
}

function xmindTopicToTree(topic) {
  if (!topic) return null;
  const title = topic.title || topic.attached?.title || 'Untitled';
  const attached = normalizeChildren(topic.children?.attached);
  return {
    title,
    children: attached.map(xmindTopicToTree).filter(Boolean),
  };
}

async function parseXmind(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const contentFile =
    zip.file('content.json') ||
    zip.file(Object.keys(zip.files).find((n) => n.endsWith('content.json')));
  if (!contentFile) throw new Error('No content.json in XMind archive');
  const json = JSON.parse(await contentFile.async('string'));
  const sheet = Array.isArray(json) ? json[0] : json;
  const rootTopic = sheet?.rootTopic || sheet?.root?.topic;
  const tree = xmindTopicToTree(rootTopic);
  if (!tree) return `# Imported\n`;
  return `${nodeToMarkdown(tree.title, tree.children).join('\n')}\n`;
}

export async function importToMarkdown(filename, buffer) {
  const lower = filename.toLowerCase();
  let md;
  if (lower.endsWith('.opml')) {
    md = parseOpml(buffer.toString('utf8'));
  } else if (lower.endsWith('.mm')) {
    md = parseFreemind(buffer.toString('utf8'));
  } else if (lower.endsWith('.xmind')) {
    md = await parseXmind(buffer);
  } else {
    throw new Error('Unsupported format (use .opml, .mm, or .xmind)');
  }
  if (!md.trim()) {
    md = `# ${titleFromFilename(filename)}\n`;
  }
  return md;
}

export function suggestImportFilename(originalName) {
  const base = originalName.replace(/\.(opml|mm|xmind)$/i, '');
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'imported';
  return `${safe}.md`;
}
