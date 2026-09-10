import {
  draftKey,
  markmapRelPath,
  splitRelPath,
} from './native-paths.mjs';

/**
 * Controller that implements the folder file semantics for the native
 * (Tauri) workspace. It is deliberately free of Tauri/browser imports so the
 * behaviour can be unit-tested in Node against a fake `fs` + `store`.
 *
 * Deps are injected:
 *   - store: native-store read/write API { readSavedFolderRecord, writeSavedFolderRecord, readDraft, writeDraft, deleteDraft, clearSavedFolderRecord }
 *   - fs:    adapter over the Rust commands
 *            { listMarkdown(rootDir), readText(abs), writeText(abs, text),
 *              deleteFile(abs), exists(abs) }
 *   - render(markdown) -> Promise<string> self-contained HTML (in-browser markmap)
 *   - importer: { convert(filename, buffer) -> Promise<{ markdown, suggestedName }> }
 *
 * relPath = a `foo/bar.md` style path rooted at rootDir.
 */

function randomId() {
  if (typeof crypto !== 'undefined' && crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `native-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function basename(rel) {
  const parts = rel.split('/');
  return parts[parts.length - 1] || rel;
}

function uniqueRel(existing, preferred) {
  if (!existing.includes(preferred)) return preferred;
  const stem = preferred.replace(/\.md$/i, '');
  let n = 2;
  while (existing.includes(`${stem}-${n}.md`)) n += 1;
  return `${stem}-${n}.md`;
}

export function createNativeFolderController({ store, fs, render, importer }) {
  let rootDir = null;
  let folderId = null;
  let folderLabel = null;
  let activeFile = null;
  let openTabs = [];

  function requireRoot() {
    if (!rootDir) throw new Error('No folder connected');
  }

  /** Validate a caller-supplied relative path before it reaches the Rust fs. */
  function assertRel(relPath, label) {
    const { ok, reason } = splitRelPath(relPath);
    if (!ok) throw new Error(`Invalid ${label} "${relPath}": ${reason}`);
    return relPath;
  }

  const mutableImporter = { current: importer || null };

  async function persistMeta() {
    requireRoot();
    await store.writeSavedFolderRecord({
      rootDir,
      folderId,
      folderLabel,
      activeFile,
      openTabs,
    });
  }

  return {
    get folderId() {
      return folderId;
    },

    get folderLabel() {
      return folderLabel;
    },

    get rootDir() {
      return rootDir;
    },

    isConnected() {
      return Boolean(rootDir);
    },

    setImporter(importerInstance) {
      mutableImporter.current = importerInstance;
    },

    /** Restore a previously saved folder (no permission prompt needed on macOS). */
    async restore(record) {
      if (!record?.rootDir) throw new Error('No saved folder');
      // If the persisted root no longer exists (moved/deleted), don't adopt it
      // as connected — surface the problem so the caller can fall back to an
      // empty/disconnected state instead of erroring on every later read.
      try {
        await fs.listMarkdown(record.rootDir);
      } catch {
        throw new Error(`Folder no longer available: ${record.rootDir}`);
      }
      rootDir = record.rootDir;
      folderId = record.folderId || randomId();
      folderLabel = record.folderLabel || basename(rootDir.replace(/[/\\]+$/, ''));
      activeFile = record.activeFile || null;
      openTabs = Array.isArray(record.openTabs) ? [...record.openTabs] : [];
      return record;
    },

    /** Adopt a freshly picked folder. */
    async adoptFromPath(pickedRoot) {
      rootDir = pickedRoot;
      folderId = randomId();
      folderLabel = basename(pickedRoot.replace(/[/\\]+$/, ''));
      activeFile = null;
      openTabs = [];
      await persistMeta();
    },

    async dismiss() {
      await store.clearSavedFolderRecord();
      rootDir = null;
      folderId = null;
      folderLabel = null;
      activeFile = null;
      openTabs = [];
    },

    async getInfo() {
      if (!rootDir) {
        return {
          mode: 'folder',
          folderName: null,
          activeFile: null,
          openTabs: [],
          markdownName: '',
          draftExists: false,
          files: [],
        };
      }
      const files = await fs.listMarkdown(rootDir);
      const active = activeFile || files[0] || null;
      if (active) this.setActiveFile(active);
      const draftText = active ? await this.readDraft(active) : '';
      return {
        mode: 'folder',
        folderName: folderLabel,
        activeFile: active,
        openTabs: openTabs.length ? openTabs : active ? [active] : [],
        markdownName: active ? basename(active) : '',
        draftExists: Boolean(draftText.trim()),
        files,
      };
    },

    async listFiles() {
      if (!rootDir) return [];
      return fs.listMarkdown(rootDir);
    },

    async readMarkdown(relPath) {
      requireRoot();
      assertRel(relPath, 'path');
      return fs.readText(rootDir, relPath);
    },

    async readDraft(relPath) {
      requireRoot();
      return store.readDraft(draftKey(folderId, relPath));
    },

    async writeDraft(relPath, text) {
      requireRoot();
      await store.writeDraft(draftKey(folderId, relPath), text);
    },

    async saveMarkdown(relPath, text) {
      requireRoot();
      assertRel(relPath, 'path');
      await fs.writeText(rootDir, relPath, text);
      await store.writeDraft(draftKey(folderId, relPath), text);

      const html = await render(text);
      await fs.writeText(rootDir, markmapRelPath(relPath), html);

      this.setActiveFile(relPath);
      await persistMeta();
    },

    async createFile(name) {
      requireRoot();
      const rel = /\.md$/i.test(name) ? name : `${name}.md`;
      const { parts, ok, reason } = splitRelPath(rel);
      if (!ok) throw new Error(`Invalid file name: ${reason}`);
      const title = basename(rel).replace(/\.md$/i, '').replace(/[-_]+/g, ' ');
      await fs.writeText(rootDir, rel, `# ${title}\n`);
      await persistMeta();
      return rel;
    },

    async renameFile(from, to) {
      requireRoot();
      const next = /\.md$/i.test(to) ? to : `${to}.md`;
      assertRel(from, 'source');
      assertRel(next, 'target');
      const text = await fs.readText(rootDir, from);
      await fs.writeText(rootDir, next, text);
      await fs.deleteFile(rootDir, from);

      const draft = await store.readDraft(draftKey(folderId, from));
      if (draft) {
        await store.writeDraft(draftKey(folderId, next), draft);
        await store.deleteDraft(draftKey(folderId, from));
      }

      activeFile = activeFile === from ? next : activeFile;
      openTabs = openTabs.map((r) => (r === from ? next : r));
      await persistMeta();
      return next;
    },

    async importBinary(filename, buffer) {
      requireRoot();
      const convert =
        mutableImporter.current?.convert ??
        (async () => {
          throw new Error('No importer available');
        });
      const { markdown, suggestedName } = await convert(filename, buffer);
      const existing = await fs.listMarkdown(rootDir);
      const rel = uniqueRel(existing, suggestedName);
      await fs.writeText(rootDir, rel, markdown);
      await persistMeta();
      return { file: rel };
    },

    async getMarkmapHtml(relPath) {
      requireRoot();
      assertRel(relPath, 'path');
      const rel = markmapRelPath(relPath);
      if (!(await fs.exists(rootDir, rel))) return null;
      return fs.readText(rootDir, rel);
    },

    setActiveFile(relPath) {
      activeFile = relPath;
    },

    getActiveFile() {
      return activeFile;
    },

    async persistActiveFile(relPath) {
      this.setActiveFile(relPath);
      await persistMeta();
    },

    setOpenTabs(relPaths) {
      openTabs = [...relPaths];
    },

    getOpenTabs() {
      return [...openTabs];
    },

    async persistSession({ openTabs: tabs, activeFile: active } = {}) {
      if (active) this.setActiveFile(active);
      if (Array.isArray(tabs)) this.setOpenTabs(tabs);
      await persistMeta();
    },
  };
}
