import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createWorkspace } from '../../workspace.mjs';
import {
  loadSavedFolderWorkspace,
  saveFolderWorkspace,
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

async function saveFolderRecord(root, meta = {}) {
  await saveFolderWorkspace({
    handle: root,
    meta: {
      folderId: 'folder-1',
      folderLabel: 'Saved Project',
      activeFile: null,
      ...meta,
    },
  });
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
      throw new Error('unexpected folder picker call');
    },
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.indexedDB = originalIndexedDb;
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, 'window');
  } else {
    globalThis.window = originalWindow;
  }
});

describe('workspace facade', () => {
  it('reconnects a saved folder and restores the persisted active file', async () => {
    const root = dir('Project', {
      'alpha.md': file('alpha.md', '# Alpha\n'),
      nested: dir('nested', {
        'plan.md': file('plan.md', '# Plan\n'),
      }),
    });
    await saveFolderRecord(root, {
      activeFile: 'nested/plan.md',
      folderLabel: 'Planning Folder',
    });
    const workspace = createWorkspace();

    const init = await workspace.init();
    assert.deepEqual(init, {
      awaitingReconnect: true,
      folderLabel: 'Planning Folder',
    });

    await workspace.reconnectSavedFolder();
    const info = await workspace.getInfo();

    assert.equal(workspace.isFolderMode(), true);
    assert.equal(workspace.folderName, 'Planning Folder');
    assert.equal(workspace.getActiveFile(), 'nested/plan.md');
    assert.deepEqual(info.files, ['alpha.md', 'nested/plan.md']);
    assert.equal(info.activeFile, 'nested/plan.md');
    assert.equal(info.markdownName, 'plan.md');
  });

  it('persists active folder file changes for future reconnects', async () => {
    const root = dir('Project', {
      'alpha.md': file('alpha.md', '# Alpha\n'),
      'beta.md': file('beta.md', '# Beta\n'),
    });
    await saveFolderRecord(root, { activeFile: 'alpha.md' });
    const workspace = createWorkspace();
    await workspace.init();
    await workspace.reconnectSavedFolder();

    await workspace.persistActiveFile('beta.md');

    const saved = await loadSavedFolderWorkspace();
    assert.equal(workspace.getActiveFile(), 'beta.md');
    assert.equal(saved.meta.activeFile, 'beta.md');
    assert.equal(saved.meta.folderLabel, 'Saved Project');
  });

  it('imports converted files into folder mode without overwriting existing markdown', async () => {
    const root = dir('Project', {
      'import.md': file('import.md', '# Existing\n'),
      'import-2.md': file('import-2.md', '# Existing 2\n'),
    });
    await saveFolderRecord(root);
    const body = new Uint8Array([1, 2, 3]).buffer;
    const workspace = createWorkspace();
    await workspace.init();
    await workspace.reconnectSavedFolder();
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/import/convert?filename=import.opml');
      assert.equal(init.method, 'POST');
      assert.equal(init.body, body);
      return {
        ok: true,
        json: async () => ({
          markdown: '# Imported\n## Child\n',
          suggestedName: 'import.md',
        }),
      };
    };

    const result = await workspace.importBinary('import.opml', body);

    assert.deepEqual(result, { file: 'import-3.md' });
    assert.equal(await getFileText(root, 'import.md'), '# Existing\n');
    assert.equal(await getFileText(root, 'import-3.md'), '# Imported\n## Child\n');
  });
});
