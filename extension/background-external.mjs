export const PENDING_DRIVE_FILE_KEY = 'pendingDriveFileId';

/**
 * @param {string | undefined} origin
 * @returns {boolean}
 */
export function isAllowedExternalOrigin(origin) {
  if (!origin) return false;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol === 'https:' && hostname === 'preview.auramindmap.com') return true;
    if (protocol === 'http:' && hostname === 'localhost') return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * @param {unknown} message
 * @returns {message is { type: 'auramindmap:open-drive-file', fileId: string }}
 */
export function isOpenDriveFileMessage(message) {
  return (
    typeof message === 'object' &&
    message !== null &&
    /** @type {{ type?: string, fileId?: unknown }} */ (message).type ===
      'auramindmap:open-drive-file' &&
    typeof /** @type {{ fileId?: unknown }} */ (message).fileId === 'string' &&
    /** @type {{ fileId: string }} */ (message).fileId.length > 0
  );
}

/**
 * @param {unknown} message
 * @param {{ origin?: string }} sender
 * @param {{
 *   setPendingDriveFileId: (fileId: string) => Promise<void>,
 *   openEditorWindow: () => Promise<void>,
 * }} deps
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function handleExternalMessage(message, sender, deps) {
  if (!isAllowedExternalOrigin(sender.origin)) {
    return { ok: false, error: 'origin not allowed' };
  }
  if (!isOpenDriveFileMessage(message)) {
    return { ok: false, error: 'invalid message' };
  }
  await deps.setPendingDriveFileId(message.fileId);
  await deps.openEditorWindow();
  return { ok: true };
}
