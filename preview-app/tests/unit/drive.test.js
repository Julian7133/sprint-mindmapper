import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  DRIVE_SCOPE,
  fetchFileMetadata,
} from '../../drive.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Drive helpers', () => {
  it('initializes the GIS token client with the configured Drive scope', () => {
    const callback = vi.fn();
    const requestAccessToken = vi.fn();
    const initTokenClient = vi.fn(() => ({ requestAccessToken }));

    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient,
        },
      },
    });

    const client = createTokenClient({ clientId: 'client-123', callback });

    expect(client).toEqual({ requestAccessToken });
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-123',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('throws a clear error when Google Identity Services is unavailable', () => {
    vi.stubGlobal('google', undefined);

    expect(() => createTokenClient({ clientId: 'client-123', callback: vi.fn() }))
      .toThrow('Google Identity Services client is not loaded');
  });

  it('fetches metadata with an encoded file ID and bearer token', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'Roadmap.md', mimeType: 'text/markdown' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFileMetadata('token-abc', 'folder/file id')).resolves.toEqual({
      name: 'Roadmap.md',
      mimeType: 'text/markdown',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20id?fields=name,mimeType',
      { headers: { Authorization: 'Bearer token-abc' } },
    );
  });

  it('adds HTTP status to metadata failures for caller-specific guidance', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'insufficient permissions',
    })));

    await expect(fetchFileMetadata('token-abc', 'file-123')).rejects.toMatchObject({
      message: 'Drive metadata 403: insufficient permissions',
      status: 403,
    });
  });

  it('downloads file content with an encoded media URL', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => '# Sprint map',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadFileContent('token-abc', 'drive:file?1')).resolves.toBe('# Sprint map');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/drive%3Afile%3F1?alt=media',
      { headers: { Authorization: 'Bearer token-abc' } },
    );
  });

  it('adds HTTP status to download failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '',
    })));

    await expect(downloadFileContent('token-abc', 'missing-file')).rejects.toMatchObject({
      message: 'Drive download 404: Not Found',
      status: 404,
    });
  });

  it('returns actionable permission guidance for Drive file-scope denials', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('install the Chrome extension');
    expect(driveAccessMessage(500)).toBe('Could not load this file from Google Drive. Please try again.');
  });
});
