import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createFolderWorkspace } from '../../folder-workspace.mjs';

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
        req.onupgradeneeded?.();
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

function makeWorkspace(root, meta = {}) {
  const workspace = createFolderWorkspace();
  return {
    workspace,
    restore: () =>
      workspace.restoreSaved({
        handle: root,
        meta: {
          folderId: 'folder-1',
          folderLabel: root.name,
          activeFile: null,
          ...meta,
        },
      }),
  };
}

let originalIndexedDb;
let originalFetch;

beforeEach(() => {
  originalIndexedDb = globalThis.indexedDB;
  originalFetch = globalThis.fetch;
  installIndexedDb();
});

afterEach(() => {
  globalThis.indexedDB = originalIndexedDb;
  globalThis.fetch = originalFetch;
});

describe('folder-workspace', () => {
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
    const { workspace, restore } = makeWorkspace(root);
    await restore();

    assert.deepEqual(await workspace.listFiles(), ['alpha.md', 'nested/beta.md']);
  });

  it('creates nested markdown files with generated heading text', async () => {
    const root = dir('Project');
    const { workspace, restore } = makeWorkspace(root);
    await restore();

    const relPath = await workspace.createFile('plans/q3-roadmap');

    assert.equal(relPath, 'plans/q3-roadmap.md');
    assert.equal(await getFileText(root, 'plans/q3-roadmap.md'), '# q3 roadmap\n');
  });

  it('saves markdown, stores a draft by folder id, and writes rendered HTML beside the source', async () => {
    const root = dir('Project', {
      notes: dir('notes', {
        'plan.md': file('plan.md', '# Old\n'),
      }),
    });
    const { workspace, restore } = makeWorkspace(root);
    await restore();
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/render');
      assert.equal(init.method, 'POST');
      const body = JSON.parse(init.body);
      assert.deepEqual(body, {
        markdown: '# Updated\n',
        basename: 'plan',
      });
      return {
        ok: true,
        json: async () => ({ html: '<h1>Updated</h1>' }),
      };
    };

    await workspace.saveMarkdown('notes/plan.md', '# Updated\n');

    assert.equal(await getFileText(root, 'notes/plan.md'), '# Updated\n');
    assert.equal(await workspace.readDraft('notes/plan.md'), '# Updated\n');
    assert.equal(await getFileText(root, 'notes/plan.html'), '<h1>Updated</h1>');
  });

  it('renames markdown files and moves the matching draft key', async () => {
    const root = dir('Project', {
      'old-name.md': file('old-name.md', '# Old\n'),
    });
    const { workspace, restore } = makeWorkspace(root);
    await restore();
    await workspace.writeDraft('old-name.md', '# Draft\n');

    const nextPath = await workspace.renameFile('old-name.md', 'archive/new-name');

    assert.equal(nextPath, 'archive/new-name.md');
    assert.equal(await getFileText(root, 'archive/new-name.md'), '# Old\n');
    await assert.rejects(() => root.getFileHandle('old-name.md'), /File not found/);
    assert.equal(await workspace.readDraft('old-name.md'), '');
    assert.equal(await workspace.readDraft('archive/new-name.md'), '# Draft\n');
  });
});
