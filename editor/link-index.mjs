/**
 * Folder-wide internal-link index + backlinks (M2, Task 4).
 *
 * Reads every markdown map in the folder, collects all `map:` hyperLinks, and
 * builds an inverted index so we can answer "what links into this map / node?".
 * Pure helpers (buildIndex, collectLinksFromRoot) are unit-testable; the async
 * workspace wrapper only needs the standard `ws.listFiles()` + `ws.readMarkdown()`
 * interface, so it works in server, folder, and extension modes.
 */

import { parseMarkdown } from './markmap-convert.mjs';
import { parseTarget } from './link-target.mjs';

/** Walk a parsed tree and collect every internal (map:) hyperLink. */
export function collectLinksFromRoot(root, file) {
  const links = [];
  const path = [];
  (function walk(node) {
    if (!node) return;
    if (node.hyperLink) {
      const t = parseTarget(node.hyperLink);
      if (t && t.internal) {
        links.push({
          fromFile: file,
          fromNodeId: node.id,
          fromTopic: node.topic,
          fromPath: [...path],
          target: t,
        });
      }
    }
    path.push(node.topic);
    for (const child of node.children || []) walk(child);
    path.pop();
  })(root);
  return links;
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

/** Build an inverted index from a flat link list. */
export function buildIndex(links) {
  const byTargetFile = new Map();
  const byTargetKey = new Map();
  for (const link of links) {
    push(byTargetFile, link.target.file, link);
    if (link.target.nodeRef) {
      push(byTargetKey, `${link.target.file}#${link.target.nodeRef}`, link);
    }
  }
  return { links, byTargetFile, byTargetKey };
}

/**
 * Index an object map of { relPath: markdownText }.
 * @param {Record<string,string>} mapOfFileToText
 */
export function indexMarkdowns(mapOfFileToText) {
  const links = [];
  for (const [file, text] of Object.entries(mapOfFileToText || {})) {
    const { root } = parseMarkdown(text);
    links.push(...collectLinksFromRoot(root, file));
  }
  return buildIndex(links);
}

/**
 * Async wrapper over a workspace implementing listFiles()/readMarkdown().
 * @returns {Promise<{links, byTargetFile, byTargetKey}>}
 */
export async function indexWorkspace(ws) {
  const files = await ws.listFiles();
  const map = {};
  for (const rel of files) {
    if (!/\.md$/i.test(rel)) continue;
    try {
      map[rel] = await ws.readMarkdown(rel);
    } catch {
      // skip unreadable file; keep the rest of the index
    }
  }
  return indexMarkdowns(map);
}

/**
 * Backlinks for a specific active context.
 * @returns {{ fileLinks: Array, nodeLinks: Array }}
 *   fileLinks: maps that link into `file` (any node).
 *   nodeLinks: maps that link specifically to `file#nodeId`.
 */
export function getBacklinks(index, file, nodeId = null) {
  const fileLinks = index?.byTargetFile.get(file) || [];
  const nodeLinks =
    nodeId && nodeId !== 'root'
      ? index?.byTargetKey.get(`${file}#${nodeId}`) || []
      : [];
  return { fileLinks, nodeLinks };
}
