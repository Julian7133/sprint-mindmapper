import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { renderMarkmapHtml } from './markmap-render.mjs';
import { createNativeFolderController } from './native-core.mjs';
import { validateRootDir } from './native-paths.mjs';
import * as store from './native-store.mjs';

/**
 * Tauri native workspace — a full implementation of the Workspace Interface
 * Contract (see AGENTS.md) with no local server and no Chrome-only folder API.
 *
 * File I/O goes through thin Rust commands (OS-level access to an arbitrary
 * user-chosen folder). Folders/sessions/drafts persist via plugin-store in the
 * OS app-config dir (shared across windows). Markdown -> markmap HTML uses the
 * same in-browser renderer as the extension (markmap-lib/markmap-view), so
 * there is no Node sidecar.
 */

/**
 * Adapter over the Rust fs commands. Every path command receives the connected
 * root directory plus a *relative* path; the Rust side is the trust boundary
 * and canonicalizes + confines the result (traversal and symlink escapes are
 * rejected there), so the webview can never name a file outside the opened
 * folder.
 */
const fsAdapter = {
  async listMarkdown(rootDir) {
    return invoke('list_markdown', { rootDir });
  },
  async readText(rootDir, relPath) {
    return invoke('read_text_file', { rootDir, relPath });
  },
  async writeText(rootDir, relPath, text) {
    await invoke('write_text_file', { rootDir, relPath, text });
  },
  async deleteFile(rootDir, relPath) {
    await invoke('delete_file', { rootDir, relPath });
  },
  async exists(rootDir, relPath) {
    return invoke('path_exists', { rootDir, relPath });
  },
};

async function loadImporter() {
  const mod = await import('./import-formats.mjs');
  return {
    async convert(filename, buffer) {
      const markdown = await mod.importToMarkdown(filename, buffer);
      return { markdown, suggestedName: mod.suggestImportFilename(filename) };
    },
  };
}

export function createWorkspace() {
  const controller = createNativeFolderController({
    store,
    fs: fsAdapter,
    render: renderMarkmapHtml,
    importer: null,
  });

  const ws = {
    get mode() {
      return 'folder';
    },

    get folderName() {
      return controller.folderLabel;
    },

    supportsNativeFolder: true,

    isFolderMode() {
      return true;
    },

    isNative() {
      return true;
    },

    isConnected() {
      return controller.isConnected();
    },

    current() {
      return ws;
    },

    fileQuery() {
      return '';
    },

    async init() {
      const record = await store.readSavedFolderRecord();
      if (record?.rootDir) {
        await controller.restore(record).catch(() => {});
      }
      return { awaitingReconnect: false };
    },

    async reconnectSavedFolder() {
      const record = await store.readSavedFolderRecord();
      if (!record?.rootDir) throw new Error('No saved folder');
      await controller.restore(record);
      return ws;
    },

    async openFolderPicker() {
      const picked = await openDialog({ directory: true, multiple: false });
      const rootDir = validateRootDir(picked);
      if (!rootDir) {
        const err = new Error('No folder chosen');
        err.name = 'AbortError';
        throw err;
      }
      await controller.adoptFromPath(rootDir);
      return ws;
    },

    async dismissSavedFolder() {
      await controller.dismiss();
    },

    async getInfo() {
      return controller.getInfo();
    },

    async listFiles() {
      return controller.listFiles();
    },

    async readMarkdown(relPath) {
      return controller.readMarkdown(relPath);
    },

    async readDraft(relPath) {
      return controller.readDraft(relPath);
    },

    async writeDraft(relPath, text) {
      return controller.writeDraft(relPath, text);
    },

    async saveMarkdown(relPath, text) {
      await controller.saveMarkdown(relPath, text);
      return { rendering: false };
    },

    async createFile(name) {
      return controller.createFile(name);
    },

    async renameFile(from, to) {
      return controller.renameFile(from, to);
    },

    async importBinary(filename, buffer) {
      const importer = await loadImporter();
      controller.setImporter(importer);
      return controller.importBinary(filename, buffer);
    },

    async getMarkmapHtml(relPath) {
      return controller.getMarkmapHtml(relPath);
    },

    async pollRenderStatus() {
      return { status: 'idle' };
    },

    setActiveFile(relPath) {
      controller.setActiveFile(relPath);
    },

    getActiveFile() {
      return controller.getActiveFile();
    },

    async persistActiveFile(relPath) {
      return controller.persistActiveFile(relPath);
    },

    async persistSession(opts) {
      return controller.persistSession(opts);
    },
  };

  return ws;
}
