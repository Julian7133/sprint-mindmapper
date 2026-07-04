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

async function saveFolderRecord(root, meta = {}) {
  await saveFolderWorkspace({
    handle: root,
    meta: {
      folderId: 'folder-1',
      folderLabel: root.name,
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
      throw new Error('Unexpected directory picker call');
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
  it('reconnects a saved folder and reports the remembered active file draft state', async () => {
    const root = dir('Project', {
      'first.md': file('first.md', '# First\n'),
      'second.md': file('second.md', '# Second\n'),
    });
    await saveFolderRecord(root, { activeFile: 'second.md' });
    await writeDraftKey('folder-1:second.md', '# Draft Second\n');
    const workspace = createWorkspace();

    const init = await workspace.init();
    assert.deepEqual(init, {
      awaitingReconnect: true,
      folderLabel: 'Project',
    });

    await workspace.reconnectSavedFolder();
    const info = await workspace.getInfo();

    assert.equal(workspace.isFolderMode(), true);
    assert.equal(workspace.getActiveFile(), 'second.md');
    assert.equal(info.activeFile, 'second.md');
    assert.equal(info.markdownName, 'second.md');
    assert.equal(info.draftExists, true);
    assert.deepEqual(info.files, ['first.md', 'second.md']);
  });

  it('persists active folder file changes for the next reconnect prompt', async () => {
    const root = dir('Project', {
      nested: dir('nested', {
        'plan.md': file('plan.md', '# Plan\n'),
      }),
    });
    await saveFolderRecord(root, { activeFile: 'old.md' });
    const workspace = createWorkspace();
    await workspace.init();
    await workspace.reconnectSavedFolder();

    await workspace.persistActiveFile('nested/plan.md');
    const saved = await loadSavedFolderWorkspace();

    assert.equal(saved.handle, root);
    assert.equal(saved.meta.activeFile, 'nested/plan.md');
    assert.equal(saved.meta.folderLabel, 'Project');
  });

  it('imports converted files into folder mode without overwriting existing markdown', async () => {
    const root = dir('Project', {
      'sample-import.md': file('sample-import.md', '# Existing\n'),
      'sample-import-2.md': file('sample-import-2.md', '# Existing 2\n'),
    });
    globalThis.window.showDirectoryPicker = async () => root;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/api/import/convert?filename=plan.xmind');
      assert.equal(init.method, 'POST');
      assert.equal(init.body.byteLength, 3);
      return {
        ok: true,
        json: async () => ({
          markdown: '# Imported\n## Child\n',
          suggestedName: 'sample-import.md',
        }),
      };
    };
    const workspace = createWorkspace();
    await workspace.openFolderPicker();

    const result = await workspace.importBinary('plan.xmind', new Uint8Array([1, 2, 3]));

    assert.deepEqual(result, { file: 'sample-import-3.md' });
    assert.equal(await getFileText(root, 'sample-import.md'), '# Existing\n');
    assert.equal(await getFileText(root, 'sample-import-2.md'), '# Existing 2\n');
    assert.equal(await getFileText(root, 'sample-import-3.md'), '# Imported\n## Child\n');
  });
});
