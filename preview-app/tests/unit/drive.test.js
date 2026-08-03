import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  DRIVE_SCOPE,
  fetchFileMetadata,
} from '../../drive.js';

describe('createTokenClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws a clear error when Google Identity Services is unavailable', () => {
    vi.stubGlobal('google', undefined);

    expect(() => createTokenClient({ clientId: 'client-1', callback: vi.fn() })).toThrow(
      'Google Identity Services client is not loaded',
    );
  });

  it('initializes GIS with the Drive scope and callback', () => {
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

    expect(createTokenClient({ clientId: 'client-1', callback })).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-1',
      scope: DRIVE_SCOPE,
      callback,
    });
  });
});

describe('Drive REST helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches metadata with an encoded file id and bearer token', async () => {
    const metadata = { name: 'Roadmap.md', mimeType: 'text/markdown' };
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => metadata,
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(fetchFileMetadata('token-123', 'folder/file 1')).resolves.toEqual(metadata);
    expect(fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%201?fields=name,mimeType',
      {
        headers: { Authorization: 'Bearer token-123' },
      },
    );
  });

  it('downloads file content with an encoded file id and bearer token', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      text: async () => '# Sprint map',
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(downloadFileContent('token-abc', 'file#2')).resolves.toBe('# Sprint map');
    expect(fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file%232?alt=media',
      {
        headers: { Authorization: 'Bearer token-abc' },
      },
    );
  });

  it('preserves Drive response status on failed downloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'drive.file scope cannot access this file',
      })),
    );

    await expect(downloadFileContent('token-abc', 'restricted-file')).rejects.toMatchObject({
      message: 'Drive download 403: drive.file scope cannot access this file',
      status: 403,
    });
  });
});

describe('driveAccessMessage', () => {
  it('explains Drive permission failures for 403 and 404 responses', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('install the Chrome extension');
  });

  it('returns a generic retry message for other failures', () => {
    expect(driveAccessMessage(500)).toBe(
      'Could not load this file from Google Drive. Please try again.',
    );
  });
});
