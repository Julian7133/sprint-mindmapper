import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRIVE_SCOPE,
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  fetchFileMetadata,
} from '../../drive.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createTokenClient', () => {
  it('initializes GIS with the Drive file scope and callback', () => {
    const tokenClient = { requestAccessToken: vi.fn() };
    const initTokenClient = vi.fn(() => tokenClient);
    const callback = vi.fn();

    vi.stubGlobal('google', {
      accounts: {
        oauth2: { initTokenClient },
      },
    });

    expect(createTokenClient({ clientId: 'client-id', callback })).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-id',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('throws when the GIS client is unavailable', () => {
    vi.stubGlobal('google', undefined);

    expect(() =>
      createTokenClient({
        clientId: 'client-id',
        callback: vi.fn(),
      }),
    ).toThrow('Google Identity Services client is not loaded');
  });
});

describe('Google Drive REST helpers', () => {
  it('fetches metadata using encoded file IDs and bearer auth', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'Sprint Map.md', mimeType: 'text/markdown' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFileMetadata('token-123', 'folder/file id')).resolves.toEqual({
      name: 'Sprint Map.md',
      mimeType: 'text/markdown',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20id?fields=name,mimeType',
      {
        headers: { Authorization: 'Bearer token-123' },
      },
    );
  });

  it('preserves Drive error status when metadata cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'drive.file scope does not include this file',
      })),
    );

    await expect(fetchFileMetadata('token-123', 'file-1')).rejects.toMatchObject({
      message: 'Drive metadata 403: drive.file scope does not include this file',
      status: 403,
    });
  });

  it('downloads file content using encoded file IDs and bearer auth', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => '# Sprint Map',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadFileContent('token-456', 'file:with spaces')).resolves.toBe(
      '# Sprint Map',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file%3Awith%20spaces?alt=media',
      {
        headers: { Authorization: 'Bearer token-456' },
      },
    );
  });

  it('preserves Drive error status when file content cannot be downloaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      })),
    );

    await expect(downloadFileContent('token-123', 'missing-file')).rejects.toMatchObject({
      message: 'Drive download 404: Not Found',
      status: 404,
    });
  });
});

describe('driveAccessMessage', () => {
  it('explains 403 and 404 permission failures with a user recovery path', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('install the Chrome extension');
  });

  it('uses a generic retry message for other Drive failures', () => {
    expect(driveAccessMessage(500)).toBe(
      'Could not load this file from Google Drive. Please try again.',
    );
  });
});
