/** Google Drive REST helpers for the preview app (GIS token client + drive.file scope). */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/**
 * @typedef {{ access_token: string, expires_in?: number, token_type?: string }} TokenResponse
 */

/**
 * Create a GIS OAuth2 token client. Requires `https://accounts.google.com/gsi/client`.
 * @param {{ clientId: string, scope?: string, callback: (response: TokenResponse) => void }} options
 * @returns {{ requestAccessToken: (overrideConfig?: { prompt?: string }) => void }}
 */
export function createTokenClient({ clientId, scope = DRIVE_SCOPE, callback }) {
  if (!globalThis.google?.accounts?.oauth2?.initTokenClient) {
    throw new Error('Google Identity Services client is not loaded');
  }
  return google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope,
    callback,
  });
}

/**
 * @param {string} token
 * @param {string} fileId
 * @returns {Promise<{ name: string, mimeType?: string }>}
 */
export async function fetchFileMetadata(token, fileId) {
  const url = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=name,mimeType`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`Drive metadata ${res.status}: ${detail || res.statusText}`);
    /** @type {Error & { status?: number }} */ (err).status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * @param {string} token
 * @param {string} fileId
 * @returns {Promise<string>}
 */
export async function downloadFileContent(token, fileId) {
  const url = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`Drive download ${res.status}: ${detail || res.statusText}`);
    /** @type {Error & { status?: number }} */ (err).status = res.status;
    throw err;
  }
  return res.text();
}

/**
 * User-friendly message for drive.file scope failures (403/404).
 * @param {number} status
 * @returns {string}
 */
export function driveAccessMessage(status) {
  if (status === 403 || status === 404) {
    return (
      'This file is not available with current permissions. ' +
      'Open it from Google Drive using "Open with AuraMindmap", or install the Chrome extension to edit.'
    );
  }
  return 'Could not load this file from Google Drive. Please try again.';
}
