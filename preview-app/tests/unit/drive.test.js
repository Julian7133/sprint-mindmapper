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
  it('initializes Google Identity Services with the drive.file scope', () => {
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

    expect(createTokenClient({ clientId: 'client-123', callback })).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-123',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('fails fast when the GIS client is unavailable', () => {
    vi.stubGlobal('google', undefined);

    expect(() =>
      createTokenClient({
        clientId: 'client-123',
        callback: vi.fn(),
      }),
    ).toThrow('Google Identity Services client is not loaded');
  });
});

describe('Drive REST helpers', () => {
  it('fetches metadata with an encoded file id and bearer token', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'Roadmap.md', mimeType: 'text/markdown' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFileMetadata('token-abc', 'folder/id with spaces')).resolves.toEqual({
      name: 'Roadmap.md',
      mimeType: 'text/markdown',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Fid%20with%20spaces?fields=name,mimeType',
      {
        headers: { Authorization: 'Bearer token-abc' },
      },
    );
  });

  it('downloads file content using the media endpoint', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => '# Sprint plan',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadFileContent('token-abc', 'drive-file-1')).resolves.toBe('# Sprint plan');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/drive-file-1?alt=media',
      {
        headers: { Authorization: 'Bearer token-abc' },
      },
    );
  });

  it('preserves Drive status codes on metadata failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'insufficientFilePermissions',
      })),
    );

    await expect(fetchFileMetadata('token-abc', 'denied-file')).rejects.toMatchObject({
      message: 'Drive metadata 403: insufficientFilePermissions',
      status: 403,
    });
  });

  it('preserves Drive status codes on download failures', async () => {
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
  it('gives actionable guidance for drive.file permission misses', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('install the Chrome extension');
  });

  it('uses generic retry guidance for other Drive failures', () => {
    expect(driveAccessMessage(500)).toBe('Could not load this file from Google Drive. Please try again.');
  });
});
