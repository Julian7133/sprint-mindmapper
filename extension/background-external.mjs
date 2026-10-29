export const HANDOFF_KEY_PREFIX = 'driveHandoff:';
export const ALLOWED_EXTERNAL_ORIGINS = ['https://aura.berlow.de', 'http://localhost:8888'];
export const MAX_MARKDOWN_LENGTH = 1024 * 1024;

export function isAllowedExternalOrigin(origin) {
  return ALLOWED_EXTERNAL_ORIGINS.includes(origin);
}

export function isOpenDriveFileMessage(message) {
  return Boolean(
    message && typeof message === 'object' && !Array.isArray(message) &&
    Object.keys(message).sort().join(',') === 'fileId,fileName,markdown,type' &&
    message.type === 'auramindmap:open-drive-file' &&
    typeof message.fileId === 'string' && /^[\w-]{1,200}$/.test(message.fileId) &&
    typeof message.fileName === 'string' && message.fileName.length <= 200 &&
    /^[^./\\\x00-\x1f][^/\\\x00-\x1f]*\.md$/i.test(message.fileName) &&
    typeof message.markdown === 'string' && message.markdown.length <= MAX_MARKDOWN_LENGTH
  );
}

export async function handleExternalMessage(message, sender, deps) {
  if (!isAllowedExternalOrigin(sender.origin)) return { ok: false, error: 'origin not allowed' };
  if (!isOpenDriveFileMessage(message)) return { ok: false, error: 'invalid message' };
  // Each request has its own storage key and window; concurrent requests cannot
  // overwrite one another or replace a map with unsaved edits.
  const requestId = crypto.randomUUID();
  const key = `${HANDOFF_KEY_PREFIX}${requestId}`;
  try {
    await deps.storeHandoff(key, message);
    await deps.openEditorWindow(requestId);
    return { ok: true };
  } catch {
    await deps.removeHandoff(key);
    return { ok: false, error: 'could not open editor' };
  }
}
