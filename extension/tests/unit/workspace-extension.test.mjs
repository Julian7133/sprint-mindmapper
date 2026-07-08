import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// workspace-extension imports the esbuild bundle at runtime (browser-resolvable),
// so the mock must target the bundle, not the bare-import source module.
vi.mock('../../editor/markmap-bundle.js', () => ({
  renderMarkmapHtml: vi.fn(async (md) => `<html><body>MOCK:${md}</body></html>`),
}));

import { renderMarkmapHtml } from '../../editor/markmap-bundle.js';
import { createWorkspace } from '../../editor/workspace-extension.mjs';
import {
  saveFolderWorkspace,
  loadSavedFolderWorkspace,
  clearSavedFolderWorkspace,
} from '../../editor/workspace-storage.mjs';

class MemoryFileHandle {
  kind = 'file';

  constructor(name, text = '') {
    this.name = name;
    this.text = text;
  }

  async getFile() {
    return {
      text: async () => this.text,
    };
  }

  async createWritable() {
    let nextText = '';
    return {
      write: async (text) => {
        nextText += String(text);
      },
      close: async () => {
        this.text = nextText;
      },
    };
  }
}

class MemoryDirectoryHandle {
  kind = 'directory';

  constructor(name, entries = {}) {
    this.name = name;
    this.children = new Map(Object.entries(entries));
  }

  async *entries() {
    for (const entry of this.children) {
      yield entry;
    }
  }

  async getDirectoryHandle(name, options = {}) {
    let child = this.children.get(name);
    if (!child) {
      if (!options.create) throw new Error(`Directory not found: ${name}`);
      child = new MemoryDirectoryHandle(name);
      this.children.set(name, child);
    }
    if (child.kind !== 'directory') throw new Error(`Not a directory: ${name}`);
    return child;
  }

  async getFileHandle(name, options = {}) {
    let child = this.children.get(name);
    if (!child) {
      if (!options.create) throw new Error(`File not found: ${name}`);
      child = new MemoryFileHandle(name);
      this.children.set(name, child);
    }
    if (child.kind !== 'file') throw new Error(`Not a file: ${name}`);
    return child;
  }

  async removeEntry(name) {
    this.children.delete(name);
  }

  async requestPermission() {
    return 'granted';
  }
}

function installIndexedDb() {
  const stores = new Map();
  const db = {
    objectStoreNames: {
      contains: (storeName) => stores.has(storeName),
    },
    createObjectStore(storeName) {
      stores.set(storeName, new Map());
    },
    transaction(storeName) {
      const store = stores.get(storeName);
      const tx = {
        oncomplete: null,
        onerror: null,
        objectStore() {
          return {
            get(key) {
              const req = {};
              queueMicrotask(() => {
                req.result = store.get(key);
                req.onsuccess?.();
              });
              return req;
            },
            put(value, key) {
              store.set(key, value);
              queueMicrotask(() => tx.oncomplete?.());
            },
            delete(key) {
              store.delete(key);
              queueMicrotask(() => tx.oncomplete?.());
            },
          };
        },
      };
      return tx;
    },
  };

  globalThis.indexedDB = {
    open() {
      const req = {};
      queueMicrotask(() => {
        req.result = db;
        req.onupgradeneeded?.({ target: { result: db } });
        req.onsuccess?.();
      });
      return req;
    },
  };

  return stores;
}

function file(name, text = '') {
  return new MemoryFileHandle(name, text);
}

function dir(name, entries = {}) {
  return new MemoryDirectoryHandle(name, entries);
}

async function getFileText(root, relPath) {
  const parts = relPath.split('/');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part);
  }
  const handle = await current.getFileHandle(parts.at(-1));
  return handle.text;
}

const SAMPLE_OPML = `<?xml version="1.0"?>
<opml>
  <body>
    <outline text="Imported Root"/>
  </body>
</opml>`;

let originalIndexedDb;
let originalWindow;
let uuidCounter;

beforeEach(() => {
  originalIndexedDb = globalThis.indexedDB;
  originalWindow = globalThis.window;
  installIndexedDb();
  uuidCounter = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
  });
  renderMarkmapHtml.mockClear();
});

afterEach(() => {
  globalThis.indexedDB = originalIndexedDb;
  globalThis.window = originalWindow;
  vi.unstubAllGlobals();
});

async function openPicker(ws, root) {
  globalThis.window = {
    showDirectoryPicker: vi.fn(async () => root),
  };
  return ws.openFolderPicker();
}

describe('createWorkspace', () => {
  describe('init()', () => {
    it('returns awaitingReconnect false when no saved handle', async () => {
      const ws = createWorkspace();
      await expect(ws.init()).resolves.toEqual({ awaitingReconnect: false });
    });

    it('returns awaitingReconnect true with folderLabel when handle is saved in IDB', async () => {
      const root = dir('SavedProject');
      await saveFolderWorkspace({
        handle: root,
        meta: { folderId: 'fid-1', folderLabel: 'My Label', activeFile: null },
      });

      const ws = createWorkspace();
      await expect(ws.init()).resolves.toEqual({
        awaitingReconnect: true,
        folderLabel: 'My Label',
      });
    });

    it('falls back to handle name for folderLabel when meta label is absent', async () => {
      const root = dir('HandleName');
      await saveFolderWorkspace({
        handle: root,
        meta: { folderId: 'fid-1', activeFile: null },
      });

      const ws = createWorkspace();
      await expect(ws.init()).resolves.toEqual({
        awaitingReconnect: true,
        folderLabel: 'HandleName',
      });
    });
  });

  describe('openFolderPicker()', () => {
    it('calls showDirectoryPicker and saves handle with meta to IDB', async () => {
      const root = dir('PickedFolder', { 'alpha.md': file('alpha.md', '# A\n') });
      const ws = createWorkspace();
      await ws.init();
      const picker = vi.fn(async () => root);
      globalThis.window = { showDirectoryPicker: picker };

      const result = await ws.openFolderPicker();

      expect(picker).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(result).toBe(ws);
      expect(ws.folderName).toBe('PickedFolder');
      const saved = await loadSavedFolderWorkspace();
      expect(saved.handle).toBe(root);
      expect(saved.meta.folderLabel).toBe('PickedFolder');
      expect(saved.meta.folderId).toBe('test-uuid-1');
    });

    it('generates a unique folderId via crypto.randomUUID', async () => {
      const root = dir('Project');
      const ws = createWorkspace();
      await openPicker(ws, root);

      const saved = await loadSavedFolderWorkspace();
      expect(saved.meta.folderId).toBe('test-uuid-1');
    });
  });

  describe('reconnectSavedFolder()', () => {
    it('restores handle and requests permission', async () => {
      const root = dir('Reconnect', { 'doc.md': file('doc.md', '# Doc\n') });
      await saveFolderWorkspace({
        handle: root,
        meta: { folderId: 'fid-1', folderLabel: 'Reconnect', activeFile: null },
      });
      const ws = createWorkspace();
      await ws.init();
      const permSpy = vi.spyOn(root, 'requestPermission');

      await ws.reconnectSavedFolder();

      expect(permSpy).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(await ws.listFiles()).toEqual(['doc.md']);
    });

    it('throws No saved folder when nothing is persisted', async () => {
      const ws = createWorkspace();
      await ws.init();
      await expect(ws.reconnectSavedFolder()).rejects.toThrow('No saved folder');
    });

    it('throws Folder permission denied and resets state when permission is not granted', async () => {
      const root = dir('Denied');
      root.requestPermission = async () => 'denied';
      await saveFolderWorkspace({
        handle: root,
        meta: { folderId: 'fid-1', folderLabel: 'Denied', activeFile: null },
      });
      const ws = createWorkspace();
      await ws.init();

      await expect(ws.reconnectSavedFolder()).rejects.toThrow('Folder permission denied');
      await expect(ws.listFiles()).rejects.toThrow('No folder connected');
    });
  });

  describe('dismissSavedFolder()', () => {
    it('clears IDB and resets dirHandle and meta', async () => {
      const root = dir('Dismiss');
      const ws = createWorkspace();
      await openPicker(ws, root);
      await ws.dismissSavedFolder();

      expect(await loadSavedFolderWorkspace()).toBeUndefined();
      await expect(ws.listFiles()).rejects.toThrow('No folder connected');
    });
  });

  describe('getters', () => {
    it('exposes folder mode getters', async () => {
      const ws = createWorkspace();
      expect(ws.mode).toBe('folder');
      expect(ws.isFolderMode()).toBe(true);
      expect(ws.isConnected()).toBe(false);
      expect(ws.supportsNativeFolder).toBe(true);
      expect(ws.fileQuery()).toBe('');
      expect(ws.current()).toBe(ws);
    });
  });

  describe('requireHandle guard', () => {
    it('throws No folder connected for every file operation before a folder is opened', async () => {
      const ws = createWorkspace();
      const ops = [
        () => ws.getInfo(),
        () => ws.listFiles(),
        () => ws.readMarkdown('a.md'),
        () => ws.readDraft('a.md'),
        () => ws.writeDraft('a.md', 'x'),
        () => ws.saveMarkdown('a.md', 'x'),
        () => ws.createFile('a'),
        () => ws.renameFile('a.md', 'b.md'),
        () => ws.importBinary('a.opml', Buffer.from(SAMPLE_OPML)),
        () => ws.getMarkmapHtml('a.md'),
        () => ws.persistActiveFile('a.md'),
      ];
      for (const op of ops) {
        await expect(op()).rejects.toThrow('No folder connected');
      }
    });
  });

  describe('listFiles()', () => {
    it('lists markdown files recursively while skipping generated and ignored paths', async () => {
      const root = dir('Project', {
        'alpha.md': file('alpha.md'),
        'alpha.md.editor-draft': file('alpha.md.editor-draft'),
        '.hidden.md': file('.hidden.md'),
        nested: dir('nested', {
          'beta.md': file('beta.md'),
          'notes.txt': file('notes.txt'),
        }),
        node_modules: dir('node_modules', {
          'package.md': file('package.md'),
        }),
        '.cache': dir('.cache', {
          'cached.md': file('cached.md'),
        }),
      });
      const ws = createWorkspace();
      await openPicker(ws, root);

      expect(await ws.listFiles()).toEqual(['alpha.md', 'nested/beta.md']);
    });
  });

  describe('readMarkdown()', () => {
    it('reads nested file content', async () => {
      const root = dir('Project', {
        docs: dir('docs', {
          'plan.md': file('plan.md', '# Nested plan\n'),
        }),
      });
      const ws = createWorkspace();
      await openPicker(ws, root);

      expect(await ws.readMarkdown('docs/plan.md')).toBe('# Nested plan\n');
    });
  });

  describe('readDraft() / writeDraft()', () => {
    it('round-trips drafts keyed by folderId', async () => {
      const root = dir('Project');
      const ws = createWorkspace();
      await openPicker(ws, root);

      await ws.writeDraft('notes.md', '# Draft content\n');
      expect(await ws.readDraft('notes.md')).toBe('# Draft content\n');
    });

    it('returns empty string when no draft exists', async () => {
      const root = dir('Project');
      const ws = createWorkspace();
      await openPicker(ws, root);

      expect(await ws.readDraft('missing.md')).toBe('');
    });
  });

  describe('saveMarkdown()', () => {
    it('writes md, draft, sibling html from renderMarkmapHtml, and returns rendering false', async () => {
      const root = dir('Project', {
        notes: dir('notes', {
          'plan.md': file('plan.md', '# Old\n'),
        }),
      });
      const ws = createWorkspace();
      await openPicker(ws, root);

      const result = await ws.saveMarkdown('notes/plan.md', '# Updated\n');

      expect(result).toEqual({ rendering: false });
      expect(renderMarkmapHtml).toHaveBeenCalledWith('# Updated\n');
      expect(await getFileText(root, 'notes/plan.md')).toBe('# Updated\n');
      expect(await ws.readDraft('notes/plan.md')).toBe('# Updated\n');
      expect(await getFileText(root, 'notes/plan.html')).toBe(
        '<html><body>MOCK:# Updated\n</body></html>',
      );
      expect(ws.getActiveFile()).toBe('notes/plan.md');
    });
  });

  describe('createFile()', () => {
    it('creates nested markdown with heading derived from filename', async () => {
      const root = dir('Project');
      const ws = createWorkspace();
      await openPicker(ws, root);

      const relPath = await ws.createFile('plans/q3-roadmap');

      expect(relPath).toBe('plans/q3-roadmap.md');
      expect(await getFileText(root, 'plans/q3-roadmap.md')).toBe('# q3 roadmap\n');
    });

    it('appends .md when extension is missing', async () => {
      const root = dir('Project');
      const ws = createWorkspace();
      await openPicker(ws, root);

      const relPath = await ws.createFile('my_file');

      expect(relPath).toBe('my_file.md');
      expect(await getFileText(root, 'my_file.md')).toBe('# my file\n');
    });
  });

  describe('renameFile()', () => {
    it('copies content, removes old file, migrates draft key, and returns new path', async () => {
      const root = dir('Project', {
        'old-name.md': file('old-name.md', '# Old\n'),
      });
      const ws = createWorkspace();
      await openPicker(ws, root);
      await ws.writeDraft('old-name.md', '# Draft\n');

      const nextPath = await ws.renameFile('old-name.md', 'archive/new-name');

      expect(nextPath).toBe('archive/new-name.md');
      expect(await getFileText(root, 'archive/new-name.md')).toBe('# Old\n');
      await expect(root.getFileHandle('old-name.md')).rejects.toThrow(/File not found/);
      expect(await ws.readDraft('old-name.md')).toBe('');
      expect(await ws.readDraft('archive/new-name.md')).toBe('# Draft\n');
    });
  });

  describe('importBinary()', () => {
    it('converts OPML and writes a new markdown file', async () => {
      const root = dir('Project');
      const ws = createWorkspace();
      await openPicker(ws, root);

      const result = await ws.importBinary('sprint.opml', Buffer.from(SAMPLE_OPML));

      expect(result).toEqual({ file: 'sprint.md' });
      expect(await getFileText(root, 'sprint.md')).toContain('# Imported Root');
    });

    it('dedupes filename collisions with numeric suffix', async () => {
      const root = dir('Project', {
        'sprint.md': file('sprint.md', '# Existing\n'),
        'sprint-2.md': file('sprint-2.md', '# Two\n'),
      });
      const ws = createWorkspace();
      await openPicker(ws, root);

      const result = await ws.importBinary('sprint.opml', Buffer.from(SAMPLE_OPML));

      expect(result).toEqual({ file: 'sprint-3.md' });
      expect(await getFileText(root, 'sprint-3.md')).toContain('# Imported Root');
    });
  });

  describe('getMarkmapHtml()', () => {
    it('returns sibling html content when present', async () => {
      const root = dir('Project', {
        'doc.md': file('doc.md', '# Doc\n'),
        'doc.html': file('doc.html', '<html>markmap</html>'),
      });
      const ws = createWorkspace();
      await openPicker(ws, root);

      expect(await ws.getMarkmapHtml('doc.md')).toBe('<html>markmap</html>');
    });

    it('returns null when html sibling is absent', async () => {
      const root = dir('Project', {
        'doc.md': file('doc.md', '# Doc\n'),
      });
      const ws = createWorkspace();
      await openPicker(ws, root);

      expect(await ws.getMarkmapHtml('doc.md')).toBeNull();
    });
  });

  describe('pollRenderStatus()', () => {
    it('always returns idle status', async () => {
      const ws = createWorkspace();
      expect(await ws.pollRenderStatus()).toEqual({ status: 'idle' });
    });
  });

  describe('active file tracking', () => {
    it('tracks active file via setActiveFile and getActiveFile', async () => {
      const root = dir('Project', { 'a.md': file('a.md') });
      const ws = createWorkspace();
      await openPicker(ws, root);

      ws.setActiveFile('a.md');
      expect(ws.getActiveFile()).toBe('a.md');
    });

    it('persists active file to IDB via persistActiveFile', async () => {
      const root = dir('Project', { 'a.md': file('a.md'), 'b.md': file('b.md') });
      const ws = createWorkspace();
      await openPicker(ws, root);

      await ws.persistActiveFile('b.md');

      const saved = await loadSavedFolderWorkspace();
      expect(saved.meta.activeFile).toBe('b.md');
    });
  });

  describe('getInfo()', () => {
    it('returns correct shape and picks first file when no active file is set', async () => {
      const root = dir('MyProject', {
        'zebra.md': file('zebra.md', '# Z\n'),
        'alpha.md': file('alpha.md', '# A\n'),
      });
      const ws = createWorkspace();
      await openPicker(ws, root);

      const info = await ws.getInfo();

      expect(info).toEqual({
        mode: 'folder',
        folderName: 'MyProject',
        activeFile: 'alpha.md',
        markdownName: 'alpha.md',
        draftExists: false,
        files: ['alpha.md', 'zebra.md'],
      });
    });

    it('reports draftExists true when a non-empty draft is stored', async () => {
      const root = dir('Project', { 'doc.md': file('doc.md', '# Doc\n') });
      const ws = createWorkspace();
      await openPicker(ws, root);
      await ws.writeDraft('doc.md', '# Unsaved edits\n');

      const info = await ws.getInfo();

      expect(info.draftExists).toBe(true);
      expect(info.activeFile).toBe('doc.md');
    });

    it('reports draftExists false when draft is empty or whitespace only', async () => {
      const root = dir('Project', { 'doc.md': file('doc.md', '# Doc\n') });
      const ws = createWorkspace();
      await openPicker(ws, root);
      await ws.writeDraft('doc.md', '   \n');

      const info = await ws.getInfo();

      expect(info.draftExists).toBe(false);
    });
  });
});
