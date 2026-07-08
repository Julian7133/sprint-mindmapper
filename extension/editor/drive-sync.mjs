/** Google Drive sync via chrome.identity + Drive REST API v3 (drive.file scope). */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const APP_FOLDER_NAME = 'AuraMindmap';
const SYNC_META_KEY = 'driveSyncMeta';

/**
 * @typedef {{ enabled?: boolean, folderId?: string, fileMap?: Record<string, string> }} DriveSyncMeta
 */

export async function requestDrivePermission() {
  if (!chrome.permissions?.request) {
    throw new Error('Drive sync requires the Chrome extension APIs');
  }
  return chrome.permissions.request({ permissions: ['identity'] });
}

export async function hasDrivePermission() {
  if (!chrome.permissions?.contains) return false;
  return chrome.permissions.contains({ permissions: ['identity'] });
}

export function getAuthToken({ interactive = true } = {}) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(token);
    });
  });
}

export async function revokeAuthToken(token) {
  if (!token) return;
  await new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

export async function signOutDrive() {
  try {
    const token = await getAuthToken({ interactive: false });
    await revokeAuthToken(token);
  } catch {
    // No cached token — already signed out.
  }
  await saveSyncMeta({ enabled: false, folderId: undefined, fileMap: {} });
}

async function driveFetch(path, token, options = {}) {
  const res = await fetch(`${DRIVE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Drive API ${res.status}: ${detail || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function loadSyncMeta() {
  const data = await chrome.storage.local.get(SYNC_META_KEY);
  return data[SYNC_META_KEY] ?? { enabled: false, fileMap: {} };
}

export async function saveSyncMeta(meta) {
  const prev = await loadSyncMeta();
  await chrome.storage.local.set({
    [SYNC_META_KEY]: { ...prev, ...meta, fileMap: meta.fileMap ?? prev.fileMap ?? {} },
  });
}

export async function findAppFolder(token) {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`,
  );
  const data = await driveFetch(
    `/files?q=${q}&spaces=drive&fields=files(id,name)&pageSize=1`,
    token,
  );
  return data.files?.[0] ?? null;
}

export async function ensureAppFolder(token) {
  const existing = await findAppFolder(token);
  if (existing) return existing.id;

  const created = await driveFetch('/files', token, {
    method: 'POST',
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  return created.id;
}

export async function listMarkdownInFolder(token, folderId) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='text/markdown' and trashed=false`,
  );
  const data = await driveFetch(
    `/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=100`,
    token,
  );
  return data.files ?? [];
}

export async function uploadMarkdown(token, folderId, name, content, existingFileId = null) {
  const metadata = {
    name: name.endsWith('.md') ? name : `${name}.md`,
    mimeType: 'text/markdown',
  };
  if (!existingFileId) {
    metadata.parents = [folderId];
  }

  const boundary = `auramindmap_${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: text/markdown\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--`;

  const path = existingFileId
    ? `/files/${existingFileId}?uploadType=multipart`
    : '/files?uploadType=multipart';

  const res = await fetch(`${DRIVE_API}${path}`, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Drive upload ${res.status}: ${detail || res.statusText}`);
  }
  return res.json();
}

/**
 * Sync the active local markdown file to Drive.
 * @param {{ relPath: string, content: string }} file
 * @returns {Promise<{ fileId: string, folderId: string }>}
 */
export async function syncFileToDrive({ relPath, content }) {
  const token = await getAuthToken({ interactive: true });
  const folderId = await ensureAppFolder(token);
  const meta = await loadSyncMeta();
  const fileName = relPath.split('/').pop();
  const existingId = meta.fileMap?.[relPath] ?? null;

  const uploaded = await uploadMarkdown(token, folderId, fileName, content, existingId);
  const fileMap = { ...(meta.fileMap ?? {}), [relPath]: uploaded.id };
  await saveSyncMeta({ enabled: true, folderId, fileMap });

  return { fileId: uploaded.id, folderId };
}

export async function downloadDriveFile(token, fileId) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Drive download ${res.status}`);
  }
  return res.text();
}
