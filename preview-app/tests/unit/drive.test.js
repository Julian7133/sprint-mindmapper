import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DRIVE_SCOPE,
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  fetchFileMetadata,
} from '../../drive.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createTokenClient', () => {
  it('initializes GIS token client with the Drive scope', () => {
    const tokenClient = { requestAccessToken: vi.fn() };
    const initTokenClient = vi.fn(() => tokenClient);
    const callback = vi.fn();
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient,
        },
      },
    });

    const result = createTokenClient({ clientId: 'client-123', callback });

    expect(result).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-123',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('throws when Google Identity Services is unavailable', () => {
    vi.stubGlobal('google', undefined);

    expect(() => createTokenClient({ clientId: 'client-123', callback: vi.fn() })).toThrow(
      'Google Identity Services client is not loaded',
    );
  });
});

describe('Drive API helpers', () => {
  it('fetches metadata with encoded file IDs and bearer auth', async () => {
    const metadata = { name: 'Sprint Map.md', mimeType: 'text/markdown' };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => metadata,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFileMetadata('token-abc', 'folder/file id?x')).resolves.toEqual(metadata);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20id%3Fx?fields=name,mimeType',
      {
        headers: { Authorization: 'Bearer token-abc' },
      },
    );
  });

  it('throws status-bearing metadata errors with Drive response details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'scope missing',
      })),
    );

    await expect(fetchFileMetadata('token-abc', 'file-1')).rejects.toMatchObject({
      message: 'Drive metadata 403: scope missing',
      status: 403,
    });
  });

  it('downloads file content with encoded file IDs and bearer auth', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => '# Sprint\n## Task',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadFileContent('token-abc', 'file id/1')).resolves.toBe('# Sprint\n## Task');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file%20id%2F1?alt=media',
      {
        headers: { Authorization: 'Bearer token-abc' },
      },
    );
  });

  it('throws status-bearing download errors with Drive response details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      })),
    );

    await expect(downloadFileContent('token-abc', 'file-1')).rejects.toMatchObject({
      message: 'Drive download 404: Not Found',
      status: 404,
    });
  });
});

describe('driveAccessMessage', () => {
  it('returns actionable guidance for drive.file permission failures', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('install the Chrome extension');
  });

  it('returns generic retry guidance for other Drive failures', () => {
    expect(driveAccessMessage(500)).toBe(
      'Could not load this file from Google Drive. Please try again.',
    );
  });
});
