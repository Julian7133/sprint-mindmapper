/**
 * Cross-map link addressing (M2).
 *
 * Internal links reuse MindElixir's `hyperLink` with the scheme:
 *   map:<relPath>            -> open <relPath> at its root
 *   map:<relPath>#<nodeRef>  -> open <relPath> and select the node
 *
 * <nodeRef> is primarily a persisted node id (see markmap-convert.mjs inline
 * anchors). When an id can't be resolved — e.g. a hand-authored or legacy link,
 * or a node that was deleted/renamed so its id no longer exists — we fall back
 * to interpreting the fragment as a `/`-joined topic path, then gracefully to
 * the map root (broken target).
 *
 * Targets are hardened: only safe relative `.md` paths are accepted. Absolute
 * paths, backslashes, `.`/`..` traversal segments, control characters, `#` in a
 * filename, empty paths, and non-`.md` files are rejected. External links are
 * limited to `http:`/`https:`. This module is pure and shared by editor +
 * extension (no DOM, no workspace dependency).
 */

export const MAP_SCHEME = 'map:';

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export function isInternalTarget(href) {
  return typeof href === 'string' && href.startsWith(MAP_SCHEME);
}

/**
 * Validate + normalize an internal map path. Returns a safe relative `.md` path
 * (the trimmed input) or null if unsafe/invalid.
 */
export function normalizeTargetFile(file) {
  if (typeof file !== 'string') return null;
  const f = file.trim();
  if (!f) return null;
  if (f.startsWith('/') || f.startsWith('\\')) return null; // absolute path
  if (f.includes('\\')) return null; // backslashes unsupported
  if (f.includes('#')) return null; // '#' reserved for the fragment separator
  if (CONTROL_RE.test(f)) return null;
  if (!/\.md$/i.test(f)) return null; // only markdown maps are linkable
  const segs = f.split('/');
  for (const seg of segs) {
    if (!seg || seg === '.' || seg === '..') return null; // empty / dot / dot-dot
  }
  return f;
}

/** True only for absolute http: / https: URLs (safe to store/open). */
export function isSafeExternalUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/** Parse a hyperLink value into a structured target. Null for invalid/garbage. */
export function parseTarget(href) {
  if (typeof href !== 'string' || !href) return null;
  if (href.startsWith(MAP_SCHEME)) {
    const rest = href.slice(MAP_SCHEME.length);
    if (!rest) return null;
    const hashIdx = rest.indexOf('#');
    const file = normalizeTargetFile(hashIdx === -1 ? rest : rest.slice(0, hashIdx));
    if (!file) return null;
    let nodeRef = null;
    if (hashIdx !== -1) {
      const raw = rest.slice(hashIdx + 1);
      if (raw) {
        let decoded;
        try {
          decoded = decodeURIComponent(raw);
        } catch {
          decoded = raw;
        }
        if (decoded && !CONTROL_RE.test(decoded)) nodeRef = decoded;
      }
    }
    return { internal: true, file, nodeRef };
  }
  return { internal: false, href };
}

/**
 * Build a `map:` hyperLink value. Returns null if the file is unsafe. nodeRef is
 * URL-encoded for safety; control characters are rejected.
 */
export function formatInternalTarget(file, nodeRef = null) {
  const f = normalizeTargetFile(file);
  if (!f) return null;
  if (nodeRef != null && nodeRef !== '' && CONTROL_RE.test(nodeRef)) return null;
  const base = `${MAP_SCHEME}${f}`;
  if (nodeRef != null && nodeRef !== '') return `${base}#${encodeURIComponent(nodeRef)}`;
  return base;
}

function findById(node, id) {
  if (!node || !id) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

/** Decode a nodeRef into topic-path segments (fallback addressing). */
export function decodeTopicPath(nodeRef) {
  if (!nodeRef) return [];
  return nodeRef.split('/').map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
}

/**
 * Resolve a nodeRef against a parsed tree root (either parseMarkdown output or
 * a live MindElixir nodeData root — both share the {id,topic,children} shape).
 * Priority: exact id -> topic path (deepest match) -> root.
 * Returns { node, mode, broken }.
 */
export function resolveNodeRef(root, nodeRef) {
  if (!nodeRef) return { node: root || null, mode: 'root', broken: false };
  const byId = findById(root, nodeRef);
  if (byId) return { node: byId, mode: 'id', broken: false };

  const path = decodeTopicPath(nodeRef);
  if (path.length && root) {
    const r = resolveTopicPath(root, path);
    return { node: r.node, mode: 'path', broken: r.broken };
  }
  return { node: root || null, mode: 'path', broken: true };
}

function resolveTopicPath(root, segments) {
  let node = root;
  let broken = false;
  for (const seg of segments) {
    const kids = node.children || [];
    const match = kids.find((c) => c.topic === seg);
    if (!match) {
      broken = true;
      break;
    }
    node = match;
  }
  return { node, broken };
}

/** Topic path (root-child -> node) as an array of topics, for display/fallback. */
export function topicPathFromNode(root, node) {
  if (!root || !node) return [];
  const path = [];
  let found = false;
  (function walk(n, trail) {
    if (found) return;
    if (n === node) {
      found = true;
      path.push(...trail);
      return;
    }
    for (const child of n.children || []) {
      walk(child, [...trail, child.topic]);
    }
  })(root, []);
  return path;
}
