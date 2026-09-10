import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { readSavedFolderRecord } from './native-store.mjs';
import { markmapRelPath } from './native-paths.mjs';

/**
 * Native-only bridge loaded from index.html (before app.js). It is bundled
 * separately (native-bridge.bundle.js) so the browser/extension copies of
 * app.js are never affected. Responsibilities:
 *
 *   1. If Rust launched this window for a detached tab (`window.__amDetachFile`),
 *      rewrite the query string so the shared app.js boots that single file —
 *      mirroring the M1 detached-window model.
 *   2. Map native File-menu actions to the existing editor UI (New / Open folder).
 *   3. Intercept the per-tab "detach ↗" control so it opens a real native
 *      Tauri window for that map (instead of a browser popup).
 *   4. Route external hyperlinks and the "Open markmap HTML" action to the OS
 *      default app via the opener plugin.
 */

const MENU_EVENT = 'auramindmap://menu';

function bootDetachedFile() {
  const rel = window.__amDetachFile;
  if (rel && typeof history?.replaceState === 'function') {
    history.replaceState(null, '', `?file=${encodeURIComponent(rel)}`);
  }
  delete window.__amDetachFile;
}

function activeRelFromDom() {
  const activeTab = document.querySelector('.tab.active');
  return activeTab?.dataset?.rel || null;
}

function dispatchDomAction(action) {
  switch (action) {
    case 'new-file': {
      const panel = document.getElementById('file-panel');
      const exportPanel = document.getElementById('export-panel');
      const newFileBtn = document.getElementById('btn-new-file');
      if (!panel || !newFileBtn) return;
      exportPanel?.classList.add('hidden');
      panel.classList.remove('hidden');
      newFileBtn.click();
      break;
    }
    case 'open-folder': {
      document.getElementById('btn-open-folder')?.click();
      break;
    }
    default:
      break;
  }
}

function interceptTabDetach() {
  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target?.closest?.('.tab-detach');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const tab = btn.closest('.tab');
      const file = tab?.dataset?.rel || null;
      invoke('open_new_window', { file }).catch((err) =>
        console.error('open_new_window failed', err)
      );
    },
    true
  );
}

function interceptExternalLinks() {
  document.addEventListener(
    'click',
    (e) => {
      const anchor = e.target?.closest?.('a.hyper-link');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (/^map:/i.test(href)) return; // internal links handled by app.js
      if (!/^https?:/i.test(href)) return;
      e.preventDefault();
      openUrl(href).catch((err) => console.error('openUrl failed', err));
    },
    true
  );
}

function interceptOpenMarkmap() {
  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target?.closest?.('#btn-open-markmap');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const rel = activeRelFromDom();
      if (!rel) return;
      // Open the generated HTML through a Rust command that confines the path
      // (no frontend `open_path` permission is granted).
      readSavedFolderRecord()
        .then((record) => {
          if (!record?.rootDir) return;
          return invoke('open_markmap_in_default_app', {
            rootDir: record.rootDir,
            relPath: markmapRelPath(rel),
          }).catch(() => {});
        })
        .catch(() => {});
    },
    true
  );
}

function wireMenuEvents() {
  listen(MENU_EVENT, (event) => {
    const action = event?.payload?.action;
    if (action) dispatchDomAction(action);
  }).catch((err) => console.error('menu listener failed', err));
}

bootDetachedFile();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      interceptTabDetach();
      interceptExternalLinks();
      interceptOpenMarkmap();
    });
  } else {
    interceptTabDetach();
    interceptExternalLinks();
    interceptOpenMarkmap();
  }
  wireMenuEvents();
}
