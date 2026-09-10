import {
  createFolderWorkspace,
  supportsNativeFolderPicker,
} from './folder-workspace.mjs';
import { clearSavedFolderWorkspace } from './workspace-storage.mjs';

function fileQuery(activeFile) {
  return activeFile ? `?file=${encodeURIComponent(activeFile)}` : '';
}

export function createWorkspace() {
  const folder = createFolderWorkspace();
  let mode = 'server';
  let savedFolderRecord = null;

  let serverActiveFile = null;

  async function readApiError(res, fallback) {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (data?.error) return data.error;
    } catch {
      /* not JSON */
    }
    return text.trim() || fallback;
  }

  const server = {
    mode: 'server',
    get folderName() {
      return null;
    },
    supportsNativeFolder: supportsNativeFolderPicker(),

    isFolderMode() {
      return false;
    },

    fileQuery() {
      return fileQuery(serverActiveFile);
    },

    async getInfo() {
      const res = await fetch(`/api/info${fileQuery(serverActiveFile)}`);
      return res.json();
    },

    async listFiles() {
      const res = await fetch(`/api/files${fileQuery(serverActiveFile)}`);
      const data = await res.json();
      return data.files || [];
    },

    async readMarkdown(relPath) {
      const res = await fetch(`/api/markdown${fileQuery(relPath)}`);
      return res.text();
    },

    async readDraft(relPath) {
      const res = await fetch(`/api/draft${fileQuery(relPath)}`);
      return res.text();
    },

    async writeDraft(relPath, text) {
      const res = await fetch(`/api/draft${fileQuery(relPath)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: text,
      });
      if (!res.ok) throw new Error(`Draft save failed (${res.status})`);
    },

    async saveMarkdown(relPath, text) {
      const res = await fetch(`/api/markdown${fileQuery(relPath)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: text,
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      return { rendering: true };
    },

    async createFile(name) {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Create failed'));
      const data = await res.json();
      return data.file;
    },

    async renameFile(from, to) {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Rename failed'));
      const data = await res.json();
      return data.file;
    },

    async importBinary(filename, buffer) {
      const params = new URLSearchParams({ filename });
      const res = await fetch(`/api/import?${params}`, {
        method: 'POST',
        body: buffer,
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Import failed'));
      return res.json();
    },

    async getMarkmapHtml(relPath) {
      const res = await fetch(`/api/markmap${fileQuery(relPath)}`);
      if (!res.ok) return null;
      return res.text();
    },

    setActiveFile(relPath) {
      serverActiveFile = relPath;
    },

    getActiveFile() {
      return serverActiveFile;
    },

    async pollRenderStatus() {
      const res = await fetch('/api/render-status');
      return res.json();
    },
  };

  const folderApi = {
    mode: 'folder',
    get folderName() {
      return folder.folderName;
    },
    supportsNativeFolder: supportsNativeFolderPicker(),

    isFolderMode() {
      return true;
    },

    fileQuery() {
      return '';
    },

    async getInfo() {
      const files = await folder.listFiles();
      const active =
        folder.getActiveFile() ||
        savedFolderRecord?.meta?.activeFile ||
        files[0] ||
        null;
      if (active) folder.setActiveFile(active);
      const draftText = active ? await folder.readDraft(active) : '';
      return {
        mode: 'folder',
        folderName: folder.folderName,
        activeFile: active,
        openTabs: folder.getOpenTabs() || (active ? [active] : []),
        markdownName: active ? active.split('/').pop() : '',
        draftExists: Boolean(draftText.trim()),
        files,
      };
    },

    async listFiles() {
      return folder.listFiles();
    },

    async readMarkdown(relPath) {
      return folder.readMarkdown(relPath);
    },

    async readDraft(relPath) {
      return folder.readDraft(relPath);
    },

    async writeDraft(relPath, text) {
      return folder.writeDraft(relPath, text);
    },

    async saveMarkdown(relPath, text) {
      await folder.saveMarkdown(relPath, text);
      folder.setActiveFile(relPath);
      await folder.persistMeta();
      return { rendering: false };
    },

    async createFile(name) {
      const rel = await folder.createFile(name);
      await folder.persistMeta();
      return rel;
    },

    async renameFile(from, to) {
      const rel = await folder.renameFile(from, to);
      await folder.persistMeta();
      return rel;
    },

    async importBinary(filename, buffer) {
      const params = new URLSearchParams({ filename });
      const res = await fetch(`/api/import/convert?${params}`, {
        method: 'POST',
        body: buffer,
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Import failed'));
      const { markdown, suggestedName } = await res.json();
      let name = suggestedName;
      const existing = await folder.listFiles();
      if (existing.includes(name)) {
        const stem = name.replace(/\.md$/i, '');
        let n = 2;
        while (existing.includes(`${stem}-${n}.md`)) n += 1;
        name = `${stem}-${n}.md`;
      }
      const rel = await folder.writeNewMarkdown(name, markdown);
      await folder.persistMeta();
      return { file: rel };
    },

    async getMarkmapHtml(relPath) {
      return folder.readMarkmapHtml(relPath);
    },

    setActiveFile(relPath) {
      folder.setActiveFile(relPath);
    },

    getActiveFile() {
      return folder.getActiveFile();
    },

    async pollRenderStatus() {
      return { status: 'idle' };
    },
  };

  function current() {
    return mode === 'folder' ? folderApi : server;
  }

  return {
    get mode() {
      return mode;
    },

    get folderName() {
      return current().folderName;
    },

    supportsNativeFolder: supportsNativeFolderPicker(),

    isFolderMode() {
      return mode === 'folder';
    },

    current,

    async init() {
      savedFolderRecord = await folder.loadSavedMeta();
      if (savedFolderRecord?.handle) {
        return {
          awaitingReconnect: true,
          folderLabel:
            savedFolderRecord.meta?.folderLabel || savedFolderRecord.handle.name,
        };
      }
      return { awaitingReconnect: false };
    },

    async reconnectSavedFolder() {
      await folder.restoreSaved(savedFolderRecord);
      mode = 'folder';
      if (savedFolderRecord?.meta) {
        folder.setActiveFile(savedFolderRecord.meta.activeFile);
      }
      return folderApi;
    },

    async openFolderPicker() {
      await folder.connectFromPicker();
      mode = 'folder';
      savedFolderRecord = await folder.loadSavedMeta();
      return folderApi;
    },

    async dismissSavedFolder() {
      await clearSavedFolderWorkspace();
      savedFolderRecord = null;
      mode = 'server';
    },

    fileQuery() {
      return current().fileQuery();
    },

    async getInfo() {
      return current().getInfo();
    },

    async listFiles() {
      return current().listFiles();
    },

    async readMarkdown(relPath) {
      return current().readMarkdown(relPath);
    },

    async readDraft(relPath) {
      return current().readDraft(relPath);
    },

    async writeDraft(relPath, text) {
      return current().writeDraft(relPath, text);
    },

    async saveMarkdown(relPath, text) {
      const result = await current().saveMarkdown(relPath, text);
      if (mode === 'folder' && savedFolderRecord) {
        savedFolderRecord.meta = {
          ...savedFolderRecord.meta,
          activeFile: relPath,
          folderLabel: folder.folderName,
        };
      }
      return result;
    },

    async createFile(name) {
      return current().createFile(name);
    },

    async renameFile(from, to) {
      return current().renameFile(from, to);
    },

    async importBinary(filename, buffer) {
      return current().importBinary(filename, buffer);
    },

    async getMarkmapHtml(relPath) {
      return current().getMarkmapHtml(relPath);
    },

    setActiveFile(relPath) {
      current().setActiveFile(relPath);
    },

    getActiveFile() {
      return current().getActiveFile();
    },

    async pollRenderStatus() {
      return current().pollRenderStatus();
    },

    async persistActiveFile(relPath) {
      if (mode !== 'folder') return;
      folder.setActiveFile(relPath);
      await folder.persistMeta();
    },

    async persistSession({ openTabs, activeFile } = {}) {
      if (mode !== 'folder') return;
      if (activeFile) folder.setActiveFile(activeFile);
      if (Array.isArray(openTabs)) folder.setOpenTabs(openTabs);
      await folder.persistMeta();
    },
  };
}
