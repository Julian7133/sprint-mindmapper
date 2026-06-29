import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createWorkspace } from '../../workspace.mjs';

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

let originalFetch;
let originalIndexedDb;
let originalWindow;
let originalCrypto;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalIndexedDb = globalThis.indexedDB;
  originalWindow = globalThis.window;
  originalCrypto = globalThis.crypto;
  globalThis.window = {};
  installIndexedDb();
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'workspace-id' },
    });
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.indexedDB = originalIndexedDb;
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
  if (originalCrypto === undefined) {
    delete globalThis.crypto;
  } else {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  }
});

describe('workspace', () => {
  it('encodes active server file paths and writes the requested markdown file', async () => {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url, init });
      if (url.startsWith('/api/info')) {
        return { json: async () => ({ activeFile: 'nested/road map.md' }) };
      }
      if (url.startsWith('/api/files')) {
        return { json: async () => ({ files: ['nested/road map.md'] }) };
      }
      if (url.startsWith('/api/markdown')) {
        return { ok: true, text: async () => '# Server copy\n' };
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

    assert.deepEqual(
      calls.map((call) => call.url),
      [
        '/api/info?file=nested%2Froad%20map.md',
        '/api/files?file=nested%2Froad%20map.md',
        '/api/markdown?file=nested%2Froad%20map.md',
        '/api/markdown?file=nested%2Froad%20map.md',
      ]
    );
    assert.equal(calls[3].init.method, 'PUT');
    assert.equal(calls[3].init.body, '# Updated\n');
  });

  it('surfaces structured server errors for failed file creation', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(url, '/api/files');
      return {
        ok: false,
        text: async () => JSON.stringify({ error: 'File already exists' }),
      };
    };

    const workspace = createWorkspace();

    await assert.rejects(() => workspace.createFile('existing'), /File already exists/);
  });

  it('imports converted files into folder mode without overwriting existing markdown', async () => {
    const root = dir('Project', {
      'imported.md': file('imported.md', '# Existing\n'),
      'imported-2.md': file('imported-2.md', '# Existing 2\n'),
    });
    globalThis.window.showDirectoryPicker = async (options) => {
      assert.deepEqual(options, { mode: 'readwrite' });
      return root;
    };
    globalThis.fetch = async (url, init = {}) => {
      assert.equal(url, '/api/import/convert?filename=source.xmind');
      assert.equal(init.method, 'POST');
      assert.ok(init.body instanceof ArrayBuffer);
      return {
        ok: true,
        json: async () => ({ markdown: '# Imported\n', suggestedName: 'imported.md' }),
      };
    };

    const workspace = createWorkspace();
    await workspace.openFolderPicker();

    const result = await workspace.importBinary('source.xmind', new ArrayBuffer(4));

    assert.deepEqual(result, { file: 'imported-3.md' });
    assert.equal(await getFileText(root, 'imported.md'), '# Existing\n');
    assert.equal(await getFileText(root, 'imported-2.md'), '# Existing 2\n');
    assert.equal(await getFileText(root, 'imported-3.md'), '# Imported\n');
    assert.equal(workspace.mode, 'folder');
  });
});
