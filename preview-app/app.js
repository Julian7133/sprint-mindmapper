import { sendEditHandoff } from './edit-handoff.js';
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
let currentMarkdown = '';
let currentDriveFileName = 'mindmap.md';

/** @type {string | null} */
let accessToken = null;

const els = {
  title: /** @type {HTMLElement} */ (document.getElementById('doc-title')),
  status: /** @type {HTMLElement} */ (document.getElementById('status')),
  preview: /** @type {HTMLIFrameElement} */ (document.getElementById('preview')),
  editBtn: /** @type {HTMLButtonElement} */ (document.getElementById('edit-btn')),
  downloadHtmlBtn: /** @type {HTMLButtonElement} */ (document.getElementById('download-html-btn')),
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
  els.preview.onload = () => {
    // Send once to our newly loaded opaque-origin sandbox. Never resend file
    // content after a navigation initiated from inside the rendered map.
    els.preview.onload = null;
    els.preview.contentWindow.postMessage({ type: 'auramindmap:render', html }, '*');
  };
  els.preview.src = './preview-frame.html';
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
  currentMarkdown = markdown;
  currentDriveFileName = meta.name ?? 'mindmap.md';
  showPreview(html, currentDriveFileName);
}

function fallbackToExtensionListing() {
  setStatus('Install AuraMindmap, then return to this preview, reload it and click Edit in AuraMindmap again.');
  // Same-tab navigation also works when the browser blocks delayed popups.
  window.location.assign(CONFIG.CWS_LISTING_URL);
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
    els.editBtn.disabled = true;
    try {
      const result = await sendEditHandoff(CONFIG.EXTENSION_ID, {
        fileId: currentFileId, fileName: currentDriveFileName, markdown: currentMarkdown,
      });
      if (result.status === 'unavailable') fallbackToExtensionListing();
      else if (result.status === 'rejected') setStatus(`Could not open editor: ${result.error || 'handoff rejected'}`, 'error');
      else setStatus('Opened a local copy in AuraMindmap. Save in the editor to choose a .md file on your computer.');
    } finally {
      els.editBtn.disabled = false;
    }
  });

  els.downloadHtmlBtn.addEventListener('click', downloadHtmlExport);

  if (els.connectBtn) {
    els.connectBtn.addEventListener('click', requestOAuthAndLoad);
  }

  requestOAuthAndLoad();
}

boot();
