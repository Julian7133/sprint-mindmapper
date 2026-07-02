import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createWorkspace } from '../../workspace.mjs';
import {
  loadSavedFolderWorkspace,
  saveFolderWorkspace,
  writeDraftKey,
} from '../../workspace-storage.mjs';

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

let originalFetch;
let originalIndexedDb;
let originalWindow;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalIndexedDb = globalThis.indexedDB;
  originalWindow = globalThis.window;
  installIndexedDb();
  globalThis.window = {
    showDirectoryPicker: async () => {
      throw new Error('Unexpected folder picker call');
    },
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.indexedDB = originalIndexedDb;
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
});

describe('workspace facade', () => {
  it('reconnects a saved folder workspace with its active file and draft state', async () => {
    const root = dir('Project', {
      'alpha.md': file('alpha.md', '# Alpha\n'),
      nested: dir('nested', {
        'beta.md': file('beta.md', '# Beta\n'),
      }),
    });
    await saveFolderWorkspace({
      handle: root,
      meta: {
        folderId: 'folder-1',
        folderLabel: 'Roadmap Library',
        activeFile: 'nested/beta.md',
      },
    });
    await writeDraftKey('folder-1:nested/beta.md', '# Draft Beta\n');

    const workspace = createWorkspace();

    assert.deepEqual(await workspace.init(), {
      awaitingReconnect: true,
      folderLabel: 'Roadmap Library',
    });
    assert.equal(workspace.isFolderMode(), false);

    const folderApi = await workspace.reconnectSavedFolder();
    const info = await workspace.getInfo();

    assert.equal(folderApi.mode, 'folder');
    assert.equal(workspace.isFolderMode(), true);
    assert.equal(workspace.folderName, 'Roadmap Library');
    assert.equal(workspace.getActiveFile(), 'nested/beta.md');
    assert.deepEqual(info, {
      mode: 'folder',
      folderName: 'Roadmap Library',
      activeFile: 'nested/beta.md',
      markdownName: 'beta.md',
      draftExists: true,
      files: ['alpha.md', 'nested/beta.md'],
    });
  });

  it('imports into a restored folder without overwriting an existing suggested filename', async () => {
    const root = dir('Project', {
      'plan.md': file('plan.md', '# Existing\n'),
      'plan-2.md': file('plan-2.md', '# Existing 2\n'),
    });
    await saveFolderWorkspace({
      handle: root,
      meta: {
        folderId: 'folder-1',
        folderLabel: 'Project',
        activeFile: null,
      },
    });
    const payload = new Uint8Array([1, 2, 3]).buffer;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/import/convert?filename=plan.opml');
      assert.equal(init.method, 'POST');
      assert.equal(init.body, payload);
      return {
        ok: true,
        json: async () => ({
          markdown: '# Imported Plan\n',
          suggestedName: 'plan.md',
        }),
      };
    };

    const workspace = createWorkspace();
    await workspace.init();
    await workspace.reconnectSavedFolder();

    assert.deepEqual(await workspace.importBinary('plan.opml', payload), {
      file: 'plan-3.md',
    });
    assert.equal(await getFileText(root, 'plan-3.md'), '# Imported Plan\n');

    const saved = await loadSavedFolderWorkspace();
    assert.equal(saved.handle, root);
    assert.equal(saved.meta.folderLabel, 'Project');
  });
});
