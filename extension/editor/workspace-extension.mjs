import {
  loadSavedFolderWorkspace,
  saveFolderWorkspace,
  clearSavedFolderWorkspace,
  readDraftKey,
  writeDraftKey,
  deleteDraftKey,
} from './workspace-storage.mjs';
import { importToMarkdown, suggestImportFilename } from './import-formats.mjs';

function draftKey(folderId, relPath) {
  return `${folderId}:${relPath}`;
}

async function listMarkdownInDir(dirHandle, prefix = '') {
  const files = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') {
      files.push(...(await listMarkdownInDir(handle, rel)));
    } else if (name.endsWith('.md') && !name.endsWith('.editor-draft')) {
      files.push(rel);
    }
  }
  return files.sort();
}

async function resolvePath(dirHandle, relPath, { create = false } = {}) {
  const parts = relPath.replace(/^[/\\]+/, '').split('/').filter(Boolean);
  if (!parts.length) throw new Error('Invalid path');
  let dir = dirHandle;
  for (let i = 0; i < parts.length - 1; i += 1) {
    dir = await dir.getDirectoryHandle(parts[i], create ? { create: true } : undefined);
  }
  const fileName = parts[parts.length - 1];
  const fileHandle = await dir.getFileHandle(fileName, create ? { create: true } : undefined);
  return { dir, fileName, fileHandle };
}

async function readFileText(fileHandle) {
  const file = await fileHandle.getFile();
  return file.text();
}

async function writeFileText(fileHandle, text) {
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

let renderMarkmapHtmlImpl = null;

async function renderMarkmapHtml(md) {
  if (!renderMarkmapHtmlImpl) {
    try {
      const mod = await import('./markmap-render.mjs');
      renderMarkmapHtmlImpl = mod.renderMarkmapHtml;
    } catch {
      renderMarkmapHtmlImpl = async (markdown) =>
        `<html><body><pre>${markdown}</pre></body></html>`;
    }
  }
  return renderMarkmapHtmlImpl(md);
}

export function createWorkspace() {
  let dirHandle = null;
  let meta = null;
  let savedFolderRecord = null;

  function requireHandle() {
    if (!dirHandle) throw new Error('No folder connected');
  }

  async function persistMeta() {
    requireHandle();
    await saveFolderWorkspace({ handle: dirHandle, meta });
  }

  const ws = {
    get mode() {
      return 'folder';
    },

    get folderName() {
      return meta?.folderLabel || dirHandle?.name || null;
    },

    supportsNativeFolder: true,

    isFolderMode() {
      return true;
    },

    current() {
      return ws;
    },

    fileQuery() {
      return '';
    },

    async init() {
      savedFolderRecord = await loadSavedFolderWorkspace();
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
      if (!savedFolderRecord?.handle) {
        throw new Error('No saved folder');
      }
      dirHandle = savedFolderRecord.handle;
      meta = savedFolderRecord.meta;
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        dirHandle = null;
        meta = null;
        throw new Error('Folder permission denied');
      }
      return ws;
    },

    async openFolderPicker() {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      dirHandle = handle;
      meta = {
        folderId: crypto.randomUUID(),
        folderLabel: handle.name,
        activeFile: null,
      };
      await saveFolderWorkspace({ handle: dirHandle, meta });
      savedFolderRecord = { handle: dirHandle, meta };
      return ws;
    },

    async dismissSavedFolder() {
      await clearSavedFolderWorkspace();
      savedFolderRecord = null;
      dirHandle = null;
      meta = null;
    },

    async getInfo() {
      requireHandle();
      const files = await listMarkdownInDir(dirHandle);
      const active =
        ws.getActiveFile() ||
        savedFolderRecord?.meta?.activeFile ||
        files[0] ||
        null;
      if (active) ws.setActiveFile(active);
      const draftText = active ? await ws.readDraft(active) : '';
      return {
        mode: 'folder',
        folderName: ws.folderName,
        activeFile: active,
        markdownName: active ? active.split('/').pop() : '',
        draftExists: Boolean(draftText.trim()),
        files,
      };
    },

    async listFiles() {
      requireHandle();
      return listMarkdownInDir(dirHandle);
    },

    async readMarkdown(relPath) {
      requireHandle();
      const { fileHandle } = await resolvePath(dirHandle, relPath);
      return readFileText(fileHandle);
    },

    async readDraft(relPath) {
      requireHandle();
      const text = await readDraftKey(draftKey(meta.folderId, relPath));
      return text ?? '';
    },

    async writeDraft(relPath, text) {
      requireHandle();
      await writeDraftKey(draftKey(meta.folderId, relPath), text);
    },

    async saveMarkdown(relPath, text) {
      requireHandle();
      const { fileHandle } = await resolvePath(dirHandle, relPath);
      await writeFileText(fileHandle, text);
      await writeDraftKey(draftKey(meta.folderId, relPath), text);

      const html = await renderMarkmapHtml(text);
      const htmlPath = relPath.replace(/\.md$/i, '.html');
      const { fileHandle: htmlHandle } = await resolvePath(dirHandle, htmlPath, {
        create: true,
      });
      await writeFileText(htmlHandle, html);

      ws.setActiveFile(relPath);
      await persistMeta();
      return { rendering: false };
    },

    async createFile(name) {
      requireHandle();
      const rel = name.endsWith('.md') ? name : `${name}.md`;
      const { fileHandle } = await resolvePath(dirHandle, rel, { create: true });
      const title = rel
        .replace(/\.md$/i, '')
        .split('/')
        .pop()
        .replace(/[-_]+/g, ' ');
      await writeFileText(fileHandle, `# ${title}\n`);
      await persistMeta();
      return rel;
    },

    async renameFile(from, to) {
      requireHandle();
      const next = to.endsWith('.md') ? to : `${to}.md`;
      const { dir: fromDir, fileName: fromName, fileHandle: fromHandle } =
        await resolvePath(dirHandle, from);
      const text = await readFileText(fromHandle);
      const { fileHandle: toHandle } = await resolvePath(dirHandle, next, { create: true });
      await writeFileText(toHandle, text);
      await fromDir.removeEntry(fromName);

      const draft = await readDraftKey(draftKey(meta.folderId, from));
      if (draft) {
        await writeDraftKey(draftKey(meta.folderId, next), draft);
        await deleteDraftKey(draftKey(meta.folderId, from));
      }
      await persistMeta();
      return next;
    },

    async importBinary(filename, buffer) {
      requireHandle();
      const markdown = await importToMarkdown(filename, buffer);
      let name = suggestImportFilename(filename);
      const existing = await listMarkdownInDir(dirHandle);
      if (existing.includes(name)) {
        const stem = name.replace(/\.md$/i, '');
        let n = 2;
        while (existing.includes(`${stem}-${n}.md`)) n += 1;
        name = `${stem}-${n}.md`;
      }
      const rel = name.endsWith('.md') ? name : `${name}.md`;
      const { fileHandle } = await resolvePath(dirHandle, rel, { create: true });
      await writeFileText(fileHandle, markdown);
      await persistMeta();
      return { file: rel };
    },

    async getMarkmapHtml(relPath) {
      requireHandle();
      const htmlPath = relPath.replace(/\.md$/i, '.html');
      try {
        const { fileHandle } = await resolvePath(dirHandle, htmlPath);
        return readFileText(fileHandle);
      } catch {
        return null;
      }
    },

    async pollRenderStatus() {
      return { status: 'idle' };
    },

    setActiveFile(relPath) {
      if (meta) meta.activeFile = relPath;
    },

    getActiveFile() {
      return meta?.activeFile || null;
    },

    async persistActiveFile(relPath) {
      requireHandle();
      ws.setActiveFile(relPath);
      await persistMeta();
    },
  };

  return ws;
}
