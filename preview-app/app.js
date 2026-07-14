import { CONFIG } from './config.js';
import {
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  fetchFileMetadata,
} from './drive.js';
import { parseFileId } from './parse-file-id.js';
import { renderMarkmapHtml } from './markmap-bundle.js';

/** @type {string | null} */
let currentFileId = null;

/** @type {string} */
let currentFileName = 'mindmap';

/** @type {string} */
let currentHtml = '';

/** @type {string | null} */
let accessToken = null;

const els = {
  title: /** @type {HTMLElement} */ (document.getElementById('doc-title')),
  status: /** @type {HTMLElement} */ (document.getElementById('status')),
  preview: /** @type {HTMLIFrameElement} */ (document.getElementById('preview')),
  editBtn: /** @type {HTMLButtonElement} */ (document.getElementById('edit-btn')),
  downloadHtmlBtn: /** @type {HTMLButtonElement} */ (document.getElementById('download-html-btn')),
  downloadSvgBtn: /** @type {HTMLButtonElement} */ (document.getElementById('download-svg-btn')),
  connectBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('connect-btn')),
};

/**
 * @param {string} message
 * @param {'info' | 'error'} [kind]
 */
function setStatus(message, kind = 'info') {
  els.status.textContent = message;
  els.status.dataset.kind = kind;
  els.status.hidden = !message;
}

/**
 * @param {boolean} ready
 */
function setToolbarEnabled(ready) {
  els.editBtn.disabled = !ready;
  els.downloadHtmlBtn.disabled = !ready;
  els.downloadSvgBtn.disabled = !ready;
}

/**
 * @param {string} html
 * @param {string} [fileName]
 */
function showPreview(html, fileName) {
  currentHtml = html;
  if (fileName) {
    currentFileName = fileName.replace(/\.md$/i, '') || 'mindmap';
    els.title.textContent = currentFileName;
  }
  els.preview.srcdoc = html;
  setToolbarEnabled(true);
  setStatus('');
}

/**
 * @param {string} token
 * @param {string} fileId
 */
async function loadDriveFile(token, fileId) {
  setStatus('Loading from Google Drive…');
  setToolbarEnabled(false);

  let meta;
  try {
    meta = await fetchFileMetadata(token, fileId);
  } catch (err) {
    const status = /** @type {{ status?: number }} */ (err).status;
    if (status === 403 || status === 404) {
      setStatus(driveAccessMessage(status), 'error');
      return;
    }
    throw err;
  }

  let markdown;
  try {
    markdown = await downloadFileContent(token, fileId);
  } catch (err) {
    const status = /** @type {{ status?: number }} */ (err).status;
    setStatus(status ? driveAccessMessage(status) : String(err), 'error');
    return;
  }

  setStatus('Rendering mind map…');
  const html = await renderMarkmapHtml(markdown);
  showPreview(html, meta.name ?? 'mindmap');
}

/**
 * @param {string} fileId
 * @returns {Promise<boolean>}
 */
function sendEditHandoff(fileId) {
  return new Promise((resolve) => {
    if (!globalThis.chrome?.runtime?.sendMessage) {
      resolve(false);
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(false);
      }
    }, 800);

    try {
      chrome.runtime.sendMessage(
        CONFIG.EXTENSION_ID,
        { type: 'auramindmap:open-drive-file', fileId },
        (resp) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (chrome.runtime.lastError || !resp?.ok) {
            resolve(false);
            return;
          }
          resolve(true);
        },
      );
    } catch {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve(false);
      }
    }
  });
}

/**
 * @param {string} fileId
 */
async function fallbackToExtensionListing(fileId) {
  try {
    await navigator.clipboard.writeText(fileId);
  } catch {
    /* clipboard may be blocked */
  }
  window.open(CONFIG.CWS_LISTING_URL, '_blank', 'noopener,noreferrer');
  setStatus(
    'Install the AuraMindmap extension, then paste the copied file ID to open this map for editing.',
    'info',
  );
}

/**
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadHtmlExport() {
  if (!currentHtml) return;
  downloadBlob(currentHtml, `${currentFileName}.html`, 'text/html;charset=utf-8');
}

function downloadSvgExport() {
  if (!currentHtml) return;
  const doc = new DOMParser().parseFromString(currentHtml, 'text/html');
  const svg = doc.querySelector('svg');
  if (!svg) {
    setStatus('No SVG found in the rendered map.', 'error');
    return;
  }
  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(svg);
  downloadBlob(svgText, `${currentFileName}.svg`, 'image/svg+xml;charset=utf-8');
}

function requestOAuthAndLoad() {
  if (!currentFileId) {
    setStatus('No Google Drive file ID in the URL.', 'error');
    return;
  }

  const client = createTokenClient({
    clientId: CONFIG.GOOGLE_CLIENT_ID,
    callback: async (response) => {
      if (response.error || !response.access_token) {
        setStatus('Google sign-in was cancelled or failed.', 'error');
        return;
      }
      accessToken = response.access_token;
      try {
        await loadDriveFile(accessToken, currentFileId);
      } catch (err) {
        setStatus(String(err), 'error');
      }
    },
  });

  client.requestAccessToken({ prompt: '' });
}

async function boot() {
  currentFileId = parseFileId(window.location.search);

  if (!currentFileId) {
    setStatus(
      'Open a mind map from Google Drive using "Open with AuraMindmap", or add ?fileId=… to the URL.',
      'error',
    );
    setToolbarEnabled(false);
    return;
  }

  els.editBtn.addEventListener('click', async () => {
    if (!currentFileId) return;
    const ok = await sendEditHandoff(currentFileId);
    if (!ok) await fallbackToExtensionListing(currentFileId);
  });

  els.downloadHtmlBtn.addEventListener('click', downloadHtmlExport);
  els.downloadSvgBtn.addEventListener('click', downloadSvgExport);

  if (els.connectBtn) {
    els.connectBtn.addEventListener('click', requestOAuthAndLoad);
  }

  requestOAuthAndLoad();
}

boot();
