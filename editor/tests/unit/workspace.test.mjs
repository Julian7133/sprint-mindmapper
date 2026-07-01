import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createWorkspace } from '../../workspace.mjs';
import { saveFolderWorkspace } from '../../workspace-storage.mjs';

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
    this.permissionRequests = [];
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

  async requestPermission(options) {
    this.permissionRequests.push(options);
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

async function saveWorkspaceRecord(root, meta = {}) {
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
  it('encodes active server file paths and surfaces structured create errors', async () => {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url, init });
      if (url === '/api/info?file=nested%2Froad%20map.md') {
        return { json: async () => ({ activeFile: 'nested/road map.md' }) };
      }
      if (url === '/api/files?file=nested%2Froad%20map.md') {
        return { json: async () => ({ files: ['nested/road map.md'] }) };
      }
      if (url === '/api/markdown?file=nested%2Froad%20map.md') {
        return { ok: true, text: async () => '# Server copy\n' };
      }
      if (url === '/api/files') {
        return {
          ok: false,
          text: async () => JSON.stringify({ error: 'File already exists' }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const workspace = createWorkspace();
    workspace.setActiveFile('nested/road map.md');

    assert.equal(workspace.fileQuery(), '?file=nested%2Froad%20map.md');
    assert.deepEqual(await workspace.getInfo(), { activeFile: 'nested/road map.md' });
    assert.deepEqual(await workspace.listFiles(), ['nested/road map.md']);
    assert.equal(await workspace.readMarkdown('nested/road map.md'), '# Server copy\n');
    assert.deepEqual(await workspace.saveMarkdown('nested/road map.md', '# Updated\n'), {
      rendering: true,
    });
    await assert.rejects(() => workspace.createFile('existing'), /File already exists/);

    assert.deepEqual(
      calls.map((call) => call.url),
      [
        '/api/info?file=nested%2Froad%20map.md',
        '/api/files?file=nested%2Froad%20map.md',
        '/api/markdown?file=nested%2Froad%20map.md',
        '/api/markdown?file=nested%2Froad%20map.md',
        '/api/files',
      ]
    );
    assert.equal(calls[3].init.method, 'PUT');
    assert.equal(calls[3].init.body, '# Updated\n');
  });

  it('reconnects a saved folder with the persisted active file', async () => {
    const root = dir('Roadmap', {
      'alpha.md': file('alpha.md', '# Alpha\n'),
      nested: dir('nested', {
        'beta.md': file('beta.md', '# Beta\n'),
      }),
    });
    await saveWorkspaceRecord(root, { activeFile: 'nested/beta.md' });

    const workspace = createWorkspace();
    assert.deepEqual(await workspace.init(), {
      awaitingReconnect: true,
      folderLabel: 'Roadmap',
    });

    await workspace.reconnectSavedFolder();
    const info = await workspace.getInfo();

    assert.equal(workspace.mode, 'folder');
    assert.equal(workspace.folderName, 'Roadmap');
    assert.equal(info.activeFile, 'nested/beta.md');
    assert.equal(info.markdownName, 'beta.md');
    assert.deepEqual(info.files, ['alpha.md', 'nested/beta.md']);
    assert.deepEqual(root.permissionRequests, [{ mode: 'readwrite' }]);
  });

  it('imports converted files into folder mode without overwriting existing markdown', async () => {
    const root = dir('Roadmap', {
      'plan.md': file('plan.md', '# Existing\n'),
      'plan-2.md': file('plan-2.md', '# Existing 2\n'),
    });
    await saveWorkspaceRecord(root);
    globalThis.fetch = async (url, init = {}) => {
      assert.equal(url, '/api/import/convert?filename=plan.xmind');
      assert.equal(init.method, 'POST');
      assert.deepEqual(init.body, new Uint8Array([1, 2, 3]));
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
    const result = await workspace.importBinary('plan.xmind', new Uint8Array([1, 2, 3]));

    assert.deepEqual(result, { file: 'plan-3.md' });
    assert.equal(await getFileText(root, 'plan.md'), '# Existing\n');
    assert.equal(await getFileText(root, 'plan-2.md'), '# Existing 2\n');
    assert.equal(await getFileText(root, 'plan-3.md'), '# Imported Plan\n');
  });
});
