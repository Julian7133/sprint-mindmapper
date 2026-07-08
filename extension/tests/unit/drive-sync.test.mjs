import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  APP_FOLDER_NAME,
  ensureAppFolder,
  findAppFolder,
  listMarkdownInFolder,
  uploadMarkdown,
  loadSyncMeta,
  saveSyncMeta,
  signOutDrive,
  syncFileToDrive,
} from '../../editor/drive-sync.mjs';

const storage = {};

beforeEach(() => {
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key) => {
          if (typeof key === 'string') return { [key]: storage[key] };
          return storage;
        }),
        set: vi.fn(async (obj) => {
          Object.assign(storage, obj);
        }),
      },
    },
    permissions: {
      request: vi.fn(async () => true),
      contains: vi.fn(async () => true),
    },
    runtime: {
      lastError: null,
    },
    identity: {
      getAuthToken: vi.fn((_opts, cb) => cb('test-token')),
      removeCachedAuthToken: vi.fn((_opts, cb) => cb()),
    },
  });
  Object.keys(storage).forEach((k) => delete storage[k]);
});

describe('drive-sync meta', () => {
  it('loads default meta when unset', async () => {
    const meta = await loadSyncMeta();
    expect(meta.enabled).toBe(false);
    expect(meta.fileMap).toEqual({});
  });

  it('persists folderId and fileMap', async () => {
    await saveSyncMeta({ enabled: true, folderId: 'folder-1', fileMap: { 'a.md': 'id-1' } });
    const meta = await loadSyncMeta();
    expect(meta.folderId).toBe('folder-1');
    expect(meta.fileMap['a.md']).toBe('id-1');
  });
});

describe('drive-sync API helpers', () => {
  it('findAppFolder returns first matching folder', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ files: [{ id: 'f1', name: APP_FOLDER_NAME }] }),
      })),
    );

    const folder = await findAppFolder('token');
    expect(folder.id).toBe('f1');
  });

  it('ensureAppFolder creates folder when missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, opts) => {
        if (url.includes('q=')) {
          return { ok: true, status: 200, json: async () => ({ files: [] }) };
        }
        expect(opts.method).toBe('POST');
        return { ok: true, status: 200, json: async () => ({ id: 'new-folder' }) };
      }),
    );

    const id = await ensureAppFolder('token');
    expect(id).toBe('new-folder');
  });

  it('listMarkdownInFolder returns drive files', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ files: [{ id: '1', name: 'sprint.md' }] }),
      })),
    );

    const files = await listMarkdownInFolder('token', 'folder-1');
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('sprint.md');
  });

  it('uploadMarkdown posts multipart body for new files', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, opts) => {
        expect(opts.method).toBe('POST');
        expect(String(opts.body)).toContain('sprint.md');
        expect(String(opts.body)).toContain('# Sprint');
        return { ok: true, status: 200, json: async () => ({ id: 'uploaded-1' }) };
      }),
    );

    const result = await uploadMarkdown('token', 'folder-1', 'sprint.md', '# Sprint\n');
    expect(result.id).toBe('uploaded-1');
  });

  it('uploadMarkdown patches existing files and normalizes markdown names', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, opts) => {
        expect(url).toContain('/files/existing-1?uploadType=multipart');
        expect(opts.method).toBe('PATCH');
        expect(String(opts.body)).toContain('"name":"sprint.md"');
        expect(String(opts.body)).not.toContain('"parents"');
        expect(String(opts.body)).toContain('# Sprint');
        return { ok: true, status: 200, json: async () => ({ id: 'existing-1' }) };
      }),
    );

    const result = await uploadMarkdown('token', 'folder-1', 'sprint', '# Sprint\n', 'existing-1');
    expect(result.id).toBe('existing-1');
  });
});

describe('drive-sync orchestration', () => {
  it('syncFileToDrive updates an existing Drive file and persists the relPath mapping', async () => {
    await saveSyncMeta({
      enabled: false,
      fileMap: { 'plans/sprint.md': 'existing-1', 'archive/old.md': 'old-1' },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, opts = {}) => {
        if (url.includes('q=')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ files: [{ id: 'folder-1', name: APP_FOLDER_NAME }] }),
          };
        }

        expect(url).toContain('/files/existing-1?uploadType=multipart');
        expect(opts.method).toBe('PATCH');
        expect(String(opts.body)).toContain('"name":"sprint.md"');
        expect(String(opts.body)).toContain('# Updated Sprint');
        return { ok: true, status: 200, json: async () => ({ id: 'existing-2' }) };
      }),
    );

    const result = await syncFileToDrive({
      relPath: 'plans/sprint.md',
      content: '# Updated Sprint\n',
    });

    expect(result).toEqual({ fileId: 'existing-2', folderId: 'folder-1' });
    expect(chrome.identity.getAuthToken).toHaveBeenCalledWith({ interactive: true }, expect.any(Function));

    const meta = await loadSyncMeta();
    expect(meta.enabled).toBe(true);
    expect(meta.folderId).toBe('folder-1');
    expect(meta.fileMap).toEqual({
      'plans/sprint.md': 'existing-2',
      'archive/old.md': 'old-1',
    });
  });

  it('signOutDrive revokes the cached token and clears persisted sync state', async () => {
    await saveSyncMeta({ enabled: true, folderId: 'folder-1', fileMap: { 'plans/sprint.md': 'id-1' } });

    await signOutDrive();

    expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith(
      { token: 'test-token' },
      expect.any(Function),
    );

    const meta = await loadSyncMeta();
    expect(meta.enabled).toBe(false);
    expect(meta.folderId).toBeUndefined();
    expect(meta.fileMap).toEqual({});
  });
});
