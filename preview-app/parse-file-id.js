/**
 * Resolve a Google Drive file ID from the preview app URL.
 * Supports Drive "Open with" `state` JSON, `?fileId=`, and `?id=`.
 * @param {string} search - window.location.search (including leading `?`)
 * @returns {string | null}
 */
export function parseFileId(search) {
  const params = new URLSearchParams(search);
  const stateRaw = params.get('state');
  if (stateRaw) {
    try {
      const state = JSON.parse(stateRaw);
      if (Array.isArray(state.ids) && state.ids[0]) return String(state.ids[0]);
    } catch {
      /* fall through */
    }
  }
  return params.get('fileId') || params.get('id') || null;
}
