/**
 * Pure path helpers for the native (Tauri) workspace.
 *
 * These have no Tauri/browser dependency so they can be unit-tested in Node.
 *
 * The workspace models a folder by its absolute root directory plus relative
 * paths ("relPath") that are identical in shape to the browser folder backend
 * (e.g. `planning/sprint-1.md`). Every relPath is resolved against rootDir
 * while guaranteeing the result stays inside rootDir (no `..` escapes).
 */

/**
 * Normalize a relative markdown path: strip a leading slash, split on `/` or
 * `\`, drop empty/dot segments, and reject any `..` that would escape.
 * @param {string} relPath
 * @returns {{ parts: string[], ok: boolean, reason?: string }}
 */
export function splitRelPath(relPath) {
  const raw = String(relPath ?? '');
  if (!raw.trim()) return { parts: [], ok: false, reason: 'empty path' };
  const parts = raw.replace(/^[/\\]+/, '').split(/[/\\]/).filter(Boolean);
  if (!parts.length) return { parts: [], ok: false, reason: 'empty path' };
  for (const part of parts) {
    if (part === '..' || part === '.') {
      return { parts, ok: false, reason: `illegal segment: ${part}` };
    }
  }
  return { parts, ok: true };
}

/**
 * Resolve a relPath against an absolute root, joining with the platform
 * separator. Guarantees the result stays within rootDir.
 * @param {string} rootDir
 * @param {string} relPath
 * @returns {string} absolute path (throws if relPath escapes rootDir)
 */
export function resolveWithin(rootDir, relPath) {
  const { parts, ok, reason } = splitRelPath(relPath);
  if (!ok) throw new Error(`Invalid relative path "${relPath}": ${reason}`);
  const joined = parts.join('/');
  const abs = rootDir.replace(/[/\\]+$/, '') + '/' + joined;
  return abs;
}

/**
 * Derive the sibling `.html` path (used for the self-contained markmap output).
 * @param {string} relPath
 * @returns {string}
 */
export function markmapRelPath(relPath) {
  return relPath.replace(/\.md$/i, '') + '.html';
}

/**
 * Guard a user-facing absolute pick result so we only ever treat real
 * directories as roots (no empty string).
 * @param {string | null | undefined} rootDir
 * @returns {string | null}
 */
export function validateRootDir(rootDir) {
  if (typeof rootDir !== 'string' || !rootDir.trim()) return null;
  return rootDir;
}

/**
 * Derive the stable draft key for a folder, mirroring the browser backends'
 * `${folderId}:${relPath}` scheme.
 * @param {string} folderId
 * @param {string} relPath
 * @returns {string}
 */
export function draftKey(folderId, relPath) {
  return `${folderId}:${relPath}`;
}
