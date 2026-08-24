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
});

describe('createTokenClient', () => {
  it('configures GIS with the preview app drive.file scope by default', () => {
    const tokenClient = { requestAccessToken: vi.fn() };
    const initTokenClient = vi.fn(() => tokenClient);
    const callback = vi.fn();

    vi.stubGlobal('google', {
      accounts: {
        oauth2: { initTokenClient },
      },
    });

    expect(createTokenClient({ clientId: 'client-123', callback })).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-123',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('fails clearly when the Google Identity Services script is unavailable', () => {
    vi.stubGlobal('google', undefined);

    expect(() => createTokenClient({ clientId: 'client-123', callback: vi.fn() })).toThrow(
      'Google Identity Services client is not loaded',
    );
  });
});

describe('Drive REST helpers', () => {
  it('fetches metadata with an encoded file ID and bearer token', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'Sprint Plan.md', mimeType: 'text/markdown' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFileMetadata('token-abc', 'folder/file id')).resolves.toEqual({
      name: 'Sprint Plan.md',
      mimeType: 'text/markdown',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20id?fields=name,mimeType',
      { headers: { Authorization: 'Bearer token-abc' } },
    );
  });

  it('throws metadata errors that preserve the Drive response status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'insufficient permissions',
      })),
    );

    await expect(fetchFileMetadata('token-abc', 'file-1')).rejects.toMatchObject({
      message: 'Drive metadata 403: insufficient permissions',
      status: 403,
    });
  });

  it('downloads file content as media with an encoded file ID', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => '# Sprint\n## Task',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadFileContent('token-abc', 'file:with/slash')).resolves.toBe(
      '# Sprint\n## Task',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file%3Awith%2Fslash?alt=media',
      { headers: { Authorization: 'Bearer token-abc' } },
    );
  });

  it('throws download errors that preserve the Drive response status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      })),
    );

    await expect(downloadFileContent('token-abc', 'missing-file')).rejects.toMatchObject({
      message: 'Drive download 404: Not Found',
      status: 404,
    });
  });
});

describe('driveAccessMessage', () => {
  it('guides users toward Drive Open-with or extension install for scoped access failures', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('install the Chrome extension');
  });

  it('uses a generic retry message for other Drive failures', () => {
    expect(driveAccessMessage(500)).toBe(
      'Could not load this file from Google Drive. Please try again.',
    );
  });
});
