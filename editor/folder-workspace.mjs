import {
  loadSavedFolderWorkspace,
  saveFolderWorkspace,
  readDraftKey,
  writeDraftKey,
  deleteDraftKey,
} from './workspace-storage.mjs';

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

export function supportsNativeFolderPicker() {
  return typeof window.showDirectoryPicker === 'function';
}

export function createFolderWorkspace() {
  let dirHandle = null;
  let meta = null;

  function requireHandle() {
    if (!dirHandle) throw new Error('No folder connected');
  }

  return {
    get folderName() {
      return meta?.folderLabel || dirHandle?.name || null;
    },

    get folderId() {
      return meta?.folderId || null;
    },

    isConnected() {
      return Boolean(dirHandle);
    },

    async connectFromPicker() {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      dirHandle = handle;
      meta = {
        folderId: crypto.randomUUID(),
        folderLabel: handle.name,
        activeFile: null,
      };
      await saveFolderWorkspace({ handle, meta });
      return meta;
    },

    async restoreSaved(saved) {
      dirHandle = saved.handle;
      meta = saved.meta;
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        dirHandle = null;
        throw new Error('Folder permission denied');
      }
      return meta;
    },

    async loadSavedMeta() {
      return loadSavedFolderWorkspace();
    },

    async persistMeta() {
      requireHandle();
      await saveFolderWorkspace({ handle: dirHandle, meta });
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

      const stem = relPath.replace(/\.md$/i, '').split('/').pop();
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: text, basename: stem }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Render failed (${res.status})`);
      }
      const { html } = await res.json();
      const htmlPath = relPath.replace(/\.md$/i, '.html');
      const { fileHandle: htmlHandle } = await resolvePath(dirHandle, htmlPath, {
        create: true,
      });
      await writeFileText(htmlHandle, html);
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
      return rel;
    },

    async writeNewMarkdown(name, markdown) {
      requireHandle();
      const rel = name.endsWith('.md') ? name : `${name}.md`;
      const { fileHandle } = await resolvePath(dirHandle, rel, { create: true });
      await writeFileText(fileHandle, markdown);
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
      return next;
    },

    async readMarkmapHtml(relPath) {
      requireHandle();
      const htmlPath = relPath.replace(/\.md$/i, '.html');
      try {
        const { fileHandle } = await resolvePath(dirHandle, htmlPath);
        return readFileText(fileHandle);
      } catch {
        return null;
      }
    },

    setActiveFile(relPath) {
      if (meta) meta.activeFile = relPath;
    },

    getActiveFile() {
      return meta?.activeFile || null;
    },
  };
}
