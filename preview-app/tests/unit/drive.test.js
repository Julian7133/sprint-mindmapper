import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DRIVE_SCOPE,
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  fetchFileMetadata,
} from '../../drive.js';

let originalFetch;
let originalGoogle;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalGoogle = globalThis.google;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.google = originalGoogle;
  vi.restoreAllMocks();
});

describe('createTokenClient', () => {
  it('initializes GIS with the configured client, Drive scope, and callback', () => {
    const callback = vi.fn();
    const tokenClient = { requestAccessToken: vi.fn() };
    const initTokenClient = vi.fn(() => tokenClient);
    globalThis.google = {
      accounts: {
        oauth2: {
          initTokenClient,
        },
      },
    };

    expect(createTokenClient({ clientId: 'client-id', callback })).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-id',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('throws a clear error when GIS has not loaded', () => {
    globalThis.google = undefined;

    expect(() => createTokenClient({ clientId: 'client-id', callback: vi.fn() })).toThrow(
      'Google Identity Services client is not loaded',
    );
  });
});

describe('Drive REST helpers', () => {
  it('fetches metadata with an encoded file id and bearer token', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ name: 'Sprint Plan.md', mimeType: 'text/markdown' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;

    await expect(fetchFileMetadata('token-123', 'folder/file id+1')).resolves.toEqual({
      name: 'Sprint Plan.md',
      mimeType: 'text/markdown',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20id%2B1?fields=name,mimeType',
      { headers: { Authorization: 'Bearer token-123' } },
    );
  });

  it('adds status to metadata errors for access guidance', async () => {
    globalThis.fetch = vi.fn(async () => new Response('permission denied', { status: 403 }));

    await expect(fetchFileMetadata('token-123', 'blocked-file')).rejects.toMatchObject({
      message: 'Drive metadata 403: permission denied',
      status: 403,
    });
  });

  it('downloads file content with an encoded file id and bearer token', async () => {
    const fetchMock = vi.fn(async () => new Response('# Sprint\n## Task', { status: 200 }));
    globalThis.fetch = fetchMock;

    await expect(downloadFileContent('token-456', 'file/id with space')).resolves.toBe(
      '# Sprint\n## Task',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file%2Fid%20with%20space?alt=media',
      { headers: { Authorization: 'Bearer token-456' } },
    );
  });

  it('adds status to download errors so the app can show permission help', async () => {
    globalThis.fetch = vi.fn(async () => new Response('not found', { status: 404 }));

    await expect(downloadFileContent('token-456', 'missing-file')).rejects.toMatchObject({
      message: 'Drive download 404: not found',
      status: 404,
    });
  });
});

describe('driveAccessMessage', () => {
  it('returns install/open-with guidance for drive.file permission misses', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('Open it from Google Drive');
  });

  it('returns generic retry guidance for other Drive failures', () => {
    expect(driveAccessMessage(500)).toBe('Could not load this file from Google Drive. Please try again.');
  });
});
